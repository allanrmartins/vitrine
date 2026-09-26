import { useEffect, useRef, useState } from 'react';
import { Check, Eraser, Loader2, RefreshCw, Sparkles, Square, Star, Undo2, Wand2, X, ImagePlus } from 'lucide-react';
import type { AdData } from '../types.ts';
import {
  fromAiDraft,
  PROVIDER_NAMES,
  toAiDraft,
  type AiRequest,
  type AiResult,
  type AiStatus,
  type ProviderId,
  type RunInfo,
} from '../engine/aiDraft.ts';
import { fileToDataUrl, urlToBlob } from '../engine/image.ts';
import { useStoreImage } from './assets.tsx';
import type { HeroCutout } from './useHeroCutout.ts';

/** `noServer`: editor hospedado, sem a API local. `noAi`: servidor ok, mas nenhuma IA instalada e logada. */
type Status = 'checking' | 'online' | 'noServer' | 'noAi';

const CHOICE_KEY = 'vitrine.ia';

function readChoice(): ProviderId | null {
  try {
    const v = localStorage.getItem(CHOICE_KEY);
    return v === 'claude' || v === 'gemini' ? v : null;
  } catch {
    return null;
  }
}

async function asDataUrl(src: string): Promise<string> {
  return src.startsWith('data:') ? src : fileToDataUrl(await urlToBlob(src));
}

/** Limite de fotos por geração: mais que isso encarece e demora sem melhorar o anúncio. */
const MAX_PHOTOS = 12;

/**
 * `folderPhotos`: fotos da pasta imagens/ do projeto (inclusive as copiadas à mão). Quando existe, é ela a
 * bandeja do assistente, e cada foto pode ser desmarcada. Sem pasta (modo navegador), a bandeja é local.
 */
export function AiPanel({
  data,
  onApply,
  folderPhotos,
  onSetHero,
  cutout,
}: {
  data: AdData;
  onApply: (next: AdData, label: string) => void;
  folderPhotos: string[] | null;
  /** Torna a foto a principal (hero) do anúncio. */
  onSetHero: (src: string) => void;
  cutout: HeroCutout;
}) {
  const hero = data.images.main;
  const heroOriginal = data.images.mainOriginal ?? null;
  const [status, setStatus] = useState<Status>('checking');
  const [ai, setAi] = useState<AiStatus | null>(null);
  const [choice, setChoice] = useState<ProviderId | null>(readChoice);
  const ready = ai?.providers.filter((p) => p.ready) ?? [];
  // A escolhida no editor, se ainda estiver pronta; senão a padrão do servidor.
  const provider = ready.some((p) => p.id === choice) ? choice : (ai?.active ?? null);
  const providerName = provider ? PROVIDER_NAMES[provider] : 'IA';
  const [localPhotos, setLocalPhotos] = useState<string[]>([]);
  const [excluded, setExcluded] = useState<Set<string>>(() => new Set());
  const tray = folderPhotos ?? localPhotos;
  const photos = tray.filter((p) => !excluded.has(p)).slice(0, MAX_PHOTOS);
  const [notes, setNotes] = useState('');
  const [tweak, setTweak] = useState('');
  const [busy, setBusy] = useState<null | { mode: AiRequest['mode']; started: number }>(null);
  const [elapsed, setElapsed] = useState(0);
  const [message, setMessage] = useState<{ kind: 'info' | 'error'; text: string } | null>(null);
  const [undo, setUndo] = useState<AdData | null>(null);
  const abort = useRef<AbortController | null>(null);
  const storeImage = useStoreImage();
  const fileInput = useRef<HTMLInputElement>(null);

  const check = (refresh = false) => {
    setStatus('checking');
    fetch(`/api/ia${refresh ? '?refresh=1' : ''}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j: AiStatus) => {
        if (!Array.isArray(j.providers)) throw new Error();
        setAi(j);
        setStatus(j.active ? 'online' : 'noAi');
      })
      .catch(() => setStatus('noServer'));
  };
  useEffect(check, []);

  const choose = (id: ProviderId) => {
    setChoice(id);
    try {
      localStorage.setItem(CHOICE_KEY, id);
    } catch {
      // Sem storage (aba privada): a escolha vale só até recarregar.
    }
  };

  // Trocar de projeto desmonta o painel: cancela a geração em andamento para o resultado não cair no projeto novo.
  useEffect(() => () => abort.current?.abort(), []);

  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => setElapsed(Math.round((Date.now() - busy.started) / 1000)), 500);
    return () => clearInterval(t);
  }, [busy]);

  const addPhotos = async (files: FileList | File[] | null) => {
    const imgs = Array.from(files ?? []).filter((f) => f.type.startsWith('image/'));
    const urls = await Promise.all(imgs.map(async (f) => storeImage(await fileToDataUrl(f, 1600), 'foto')));
    // Com pasta, as fotos aparecem pela listagem da pasta; a lista local cobre o modo navegador.
    setLocalPhotos((p) => [...p, ...urls]);
  };

  const run = async (mode: AiRequest['mode']) => {
    const instruction = mode === 'generate' ? notes : tweak;
    if (mode === 'generate' && !photos.length && !notes.trim()) {
      setMessage({ kind: 'error', text: 'Mande ao menos uma foto ou algumas anotações sobre o item.' });
      return;
    }
    if (mode === 'tweak' && !tweak.trim()) return;
    setMessage(null);
    setElapsed(0);
    setBusy({ mode, started: Date.now() });
    abort.current = new AbortController();
    const { signal } = abort.current;
    try {
      // No modo gerar, as fotos novas ganham os primeiros números: são o material principal.
      const { draft, photos: list } = toAiDraft(data, mode === 'generate' ? photos : []);
      // A IA recebe o conteúdo das fotos; o anúncio continua apontando para os arquivos originais (`list`).
      const body: AiRequest = { mode, instruction, photos: await Promise.all(list.map(asDataUrl)), draft, provider: provider ?? undefined };
      const res = await fetch('/api/ia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal,
      });
      const json = (await res.json()) as (AiResult & RunInfo) | { error: string };
      if ('error' in json) throw new Error(json.error);
      if (signal.aborted) return;
      setUndo(data);
      onApply(fromAiDraft(json.draft, list, data), mode === 'generate' ? 'Anúncio gerado' : 'Ajuste aplicado');
      if (mode === 'tweak') setTweak('');
      const meta = `${PROVIDER_NAMES[json.provider]}, ${Math.round(json.durationMs / 1000)}s${json.costUsd ? `, US$ ${json.costUsd.toFixed(3)}` : ''}`;
      setMessage({ kind: 'info', text: json.notes ? `${json.notes} (${meta})` : `Pronto em ${meta}.` });
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setMessage({ kind: 'error', text: (e as Error).message });
    } finally {
      setBusy(null);
      abort.current = null;
    }
  };

  if (status === 'noServer') {
    return (
      <div className="ai ai-off">
        <Sparkles size={16} />
        <p>
          Assistente de IA indisponível. Rode <code>npm run dev</code> nesta máquina (com o Claude Code ou o Gemini CLI logado) para
          gerar e ajustar anúncios por texto.
        </p>
      </div>
    );
  }

  if (status === 'noAi' && ai) {
    return (
      <div className="ai ai-off">
        <Sparkles size={16} />
        <div className="ai-off-body">
          <p>
            <strong>Nenhuma IA pronta nesta máquina.</strong> O assistente usa o Claude Code ou o Gemini CLI, instalado e logado.
          </p>
          <ul>
            {ai.providers.map((p) => (
              <li key={p.id}>
                <strong>{PROVIDER_NAMES[p.id]}:</strong> {p.detail}
              </li>
            ))}
          </ul>
          <button type="button" className="btn sm" onClick={() => check(true)}>
            <RefreshCw size={14} /> Verificar de novo
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ai">
      <div className="ai-head">
        <Sparkles size={16} />
        {/* Com mais de uma IA pronta, o seletor ao lado já diz qual está em uso. */}
        <strong>{status !== 'online' ? 'Assistente de IA' : ready.length > 1 ? 'Assistente' : `Assistente ${providerName}`}</strong>
        <span
          className={`dot ${status}`}
          aria-label={status === 'online' ? 'conectado' : 'verificando'}
          title={ai?.providers.find((p) => p.id === provider)?.detail}
        />
        {ready.length > 1 && (
          <select
            className="input ai-provider"
            aria-label="IA usada pelo assistente"
            value={provider ?? ''}
            disabled={!!busy}
            onChange={(e) => choose(e.target.value as ProviderId)}
          >
            {ready.map((p) => (
              <option key={p.id} value={p.id}>
                {PROVIDER_NAMES[p.id]}
              </option>
            ))}
          </select>
        )}
        {undo && !busy && (
          <button
            type="button"
            className="btn ghost sm push"
            onClick={() => {
              onApply(undo, 'Alteração da IA desfeita');
              setUndo(null);
            }}
          >
            <Undo2 size={14} /> Desfazer
          </button>
        )}
      </div>

      <div
        className="ai-photos"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          addPhotos(e.dataTransfer.files);
        }}
        onPaste={(e) => addPhotos(e.clipboardData.files)}
      >
        {tray.map((p, i) => {
          const off = excluded.has(p);
          const toggle = () =>
            setExcluded((set) => {
              const next = new Set(set);
              if (next.has(p)) next.delete(p);
              else next.add(p);
              return next;
            });
          return (
            <div className={`ai-photo${off ? ' off' : ''}${p === hero ? ' hero' : ''}`} key={p}>
              <img src={p} alt={`Foto ${i + 1}`} />
              {p === hero ? (
                <span className="ai-hero-badge">Hero</span>
              ) : (
                <button
                  type="button"
                  className="ai-set-hero"
                  aria-label="Usar como foto principal (hero)"
                  title={p === heroOriginal ? 'Voltar a usar esta foto original como hero' : 'Usar como hero'}
                  onClick={() => onSetHero(p)}
                >
                  <Star size={11} />
                </button>
              )}
              {folderPhotos ? (
                <button
                  type="button"
                  className="ai-toggle"
                  aria-label={off ? 'Incluir foto na geração' : 'Deixar foto de fora da geração'}
                  title={off ? 'Incluir na geração' : 'Deixar de fora'}
                  onClick={toggle}
                >
                  {off ? <X size={12} /> : <Check size={12} />}
                </button>
              ) : (
                <button type="button" aria-label="Remover foto" onClick={() => setLocalPhotos((ps) => ps.filter((x) => x !== p))}>
                  <X size={12} />
                </button>
              )}
            </div>
          );
        })}
        <button type="button" className="ai-add" onClick={() => fileInput.current?.click()}>
          <ImagePlus size={18} />
          <span>{tray.length ? 'Mais fotos' : 'Fotos do item'}</span>
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            addPhotos(e.target.files);
            e.target.value = '';
          }}
        />
      </div>
      {hero && (
        <div className="ai-hero-row">
          <span className="ai-hero-thumb">
            <img src={hero} alt="Foto hero" />
          </span>
          <span className="ai-hero-text">
            <strong>Foto hero</strong>
            <span>{data.images.treatment === 'cutout' ? 'sem fundo, em destaque' : 'com fundo; remova para ela ficar maior'}</span>
          </span>
          <button
            type="button"
            className={`btn sm${data.images.treatment === 'cutout' ? ' ghost' : ''}`}
            onClick={cutout.run}
            disabled={cutout.busy}
            title="Remove o fundo da foto principal, corta as bordas vazias e aumenta o destaque dela no anúncio"
          >
            {cutout.busy ? <Loader2 className="spin" size={14} /> : <Eraser size={14} />} {cutout.label}
          </button>
          {cutout.canRestore && !cutout.busy && (
            <button type="button" className="icon-btn" aria-label="Restaurar foto original" title="Restaurar foto original" onClick={cutout.restore}>
              <Undo2 size={14} />
            </button>
          )}
        </div>
      )}
      {cutout.error && <p className="msg error">{cutout.error}</p>}
      {folderPhotos && (
        <p className="msg">
          {tray.length
            ? `${photos.length} de ${tray.length} foto${tray.length > 1 ? 's' : ''} da pasta vão para o ${providerName}${tray.length > MAX_PHOTOS ? ` (máx. ${MAX_PHOTOS})` : ''}. Clique no ✓ para deixar uma de fora.`
            : 'Solte fotos aqui ou copie para a pasta imagens/ do projeto.'}
        </p>
      )}
      <textarea
        className="input"
        rows={4}
        placeholder="Conte sobre o item: preço, estado, o que acompanha, entrega. Ex.: drone FPV 5 polegadas, R$ 3500, acompanha 1 bateria, retirada em SP."
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      <button type="button" className="btn primary" disabled={!!busy} onClick={() => run('generate')}>
        {busy?.mode === 'generate' ? <Loader2 className="spin" size={16} /> : <Sparkles size={16} />}
        {busy?.mode === 'generate'
          ? `Gerando... ${elapsed}s`
          : photos.length
            ? `Gerar anúncio com ${photos.length} foto${photos.length > 1 ? 's' : ''}`
            : 'Gerar anúncio'}
      </button>

      <div className="ai-tweak">
        <input
          className="input grow"
          placeholder='Ajuste: "título mais curto", "destaca que tem garantia"...'
          value={tweak}
          onChange={(e) => setTweak(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !busy && run('tweak')}
        />
        <button type="button" className="btn" disabled={!!busy || !tweak.trim()} onClick={() => run('tweak')} aria-label="Aplicar ajuste">
          {busy?.mode === 'tweak' ? <Loader2 className="spin" size={16} /> : <Wand2 size={16} />}
          {busy?.mode === 'tweak' ? `${elapsed}s` : 'Ajustar'}
        </button>
      </div>

      {busy && (
        <button type="button" className="btn ghost sm" onClick={() => abort.current?.abort()}>
          <Square size={12} /> Cancelar
        </button>
      )}
      {message && <p className={`msg ${message.kind}`}>{message.text}</p>}
    </div>
  );
}
