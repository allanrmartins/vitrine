import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Check, ClipboardCopy, Copy, Download, FolderInput, ImagePlay, Loader2, MessageSquareText, RefreshCw, Share2, Tag } from 'lucide-react';
import { AdCanvas, AD_HEIGHT, AD_WIDTH } from './ad/AdCanvas.tsx';
import { downloadBlob, EXPORT_PIXEL_RATIO, renderAdPng } from './engine/render.ts';
import { relativeTime, slugify } from './engine/format.ts';
import { AiPanel } from './editor/AiPanel.tsx';
import { AssetContext } from './editor/assets.tsx';
import { FolderImagesSection } from './editor/FolderImages.tsx';
import { NewProjectDialog } from './editor/ProjectDialogs.tsx';
import { ProjectExplorer } from './editor/ProjectExplorer.tsx';
import { useWorkspace } from './editor/useWorkspace.ts';
import { setHero, useHeroCutout } from './editor/useHeroCutout.ts';
import { useHeroDrag } from './editor/useHeroDrag.ts';
import { useFolderConventions } from './editor/useFolderConventions.ts';
import {
  DealSection,
  DeliverySection,
  ExtrasSection,
  FinishSection,
  HeaderSection,
  HighlightsSection,
  ImagesSection,
  KitSection,
  type Update,
} from './editor/Sections.tsx';

const canShareFiles = (() => {
  try {
    return !!navigator.canShare?.({ files: [new File([''], 'a.png', { type: 'image/png' })] });
  } catch {
    return false;
  }
})();

function useFitScale(ref: React.RefObject<HTMLElement | null>) {
  const [scale, setScale] = useState(0.5);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const { width, height } = el.getBoundingClientRect();
      if (width && height) setScale(Math.min(width / AD_WIDTH, height / AD_HEIGHT));
    };
    // Mede já na montagem (sem "piscar" em 50%) e no resize da janela; o ResizeObserver cobre o resto
    // (recolher o explorador, barra de rolagem).
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [ref]);
  return scale;
}

export default function App() {
  const [toast, setToast] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  /** Depois de "Copiar para WhatsApp", o mesmo botão passa a copiar só a descrição (para a legenda). */
  const [captionStep, setCaptionStep] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const scale = useFitScale(stageRef);
  const notify = useCallback((msg: string) => setToast(msg), []);
  const ws = useWorkspace(notify);
  const { project, setProject, description, folder } = ws;

  const data = project.data;
  const update: Update = (fn) => setProject((p) => void fn(p.data));
  const cutout = useHeroCutout(data, update, ws.storeImage);
  const frameRef = useRef<HTMLDivElement>(null);
  const heroDrag = useHeroDrag(frameRef, scale, data, update);

  useFolderConventions(folder, ws.folderImages.images, data, update, notify);

  useEffect(() => {
    if (!captionStep) return;
    const t = setTimeout(() => setCaptionStep(false), 120_000);
    return () => clearTimeout(t);
  }, [captionStep]);
  // Mudou o anúncio (ou trocou de projeto): o que está copiado ficou velho, recomeça da etapa 1.
  useEffect(() => setCaptionStep(false), [project]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3600);
    return () => clearTimeout(t);
  }, [toast]);

  /**
   * Gera o PNG, entrega o blob para `fn` (baixar, copiar, compartilhar) e grava na pasta do projeto
   * (anuncio.png + descricao.txt). Devolve o caminho gravado no disco.
   */
  const withPng = async (fn?: (blob: Blob) => Promise<void> | void): Promise<string | null> => {
    if (!canvasRef.current) return null;
    setExporting(true);
    const target = { folder, description };
    try {
      const blob = await renderAdPng(canvasRef.current);
      await fn?.(blob);
      return await ws.actions.saveExport(blob, target).catch((e) => {
        notify(`A imagem não foi gravada na pasta: ${e instanceof Error ? e.message : e}`);
        return null;
      });
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Falha ao gerar a imagem.');
      return null;
    } finally {
      setExporting(false);
    }
  };

  const fileBase = folder ?? slugify(data.title || data.subtitle);

  const actions = {
    generate: async () => {
      if (!ws.online) return actions.download();
      const saved = await withPng();
      if (saved) notify(`Imagem gerada em ${saved}`);
    },
    download: () => withPng((blob) => downloadBlob(blob, `${fileBase}.png`)),
    /**
     * Etapa 1: imagem na área de transferência. Etapa 2 (próximo clique): a descrição.
     * O WhatsApp ignora o texto quando se cola uma imagem (testado no WhatsApp Web), por isso são duas etapas.
     * O texto vai junto no item da etapa 1 mesmo assim: outros apps (Telegram, e-mail) aproveitam.
     * O PNG entra como Promise criada dentro do clique: é o formato que Chrome e Safari aceitam mesmo com a
     * renderização demorando.
     */
    copyForWhatsApp: async () => {
      if (captionStep) {
        await navigator.clipboard.writeText(description);
        setCaptionStep(false);
        notify('2/2 Descrição copiada - cole na legenda da imagem (Ctrl+V) e envie');
        return;
      }
      const text = new Blob([description], { type: 'text/plain' });
      let resolvePng!: (b: Blob) => void;
      let rejectPng!: (e: Error) => void;
      const png = new Promise<Blob>((res, rej) => {
        resolvePng = res;
        rejectPng = rej;
      });
      const rendering = withPng((blob) => resolvePng(blob)).then(() => rejectPng(new Error('Falha ao gerar a imagem.')));
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': png, 'text/plain': text })]);
        setCaptionStep(true);
        notify('1/2 Imagem copiada - cole no grupo (Ctrl+V) e volte para copiar a descrição');
      } catch {
        // Navegador que não aceita imagem + texto no mesmo item: vai só a imagem; a descrição fica para o 2º clique.
        try {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
          setCaptionStep(true);
          notify('1/2 Imagem copiada - cole no grupo (Ctrl+V) e volte para copiar a descrição');
        } catch (e) {
          notify(`Não consegui copiar: ${e instanceof Error ? e.message : e}`);
        }
      }
      await rendering;
    },
    share: () =>
      withPng(async (blob) => {
        const file = new File([blob], `${fileBase}.png`, { type: 'image/png' });
        await navigator.share({ files: [file], text: description }).catch(() => undefined);
      }),
    copyText: async () => {
      await navigator.clipboard.writeText(description);
      notify('Descrição copiada');
    },
    exportJson: () => {
      const blob = new Blob([JSON.stringify(project)], { type: 'application/json' });
      downloadBlob(blob, `${fileBase}.vitrine.json`);
    },
  };

  const saveLabel = !ws.online
    ? 'rascunho no navegador'
    : !folder
      ? 'sem pasta ainda'
      : ws.saveState === 'saving'
        ? 'salvando...'
        : ws.saveState === 'error'
          ? 'erro ao salvar'
          : 'salvo';

  return (
    <AssetContext.Provider value={ws.storeImage}>
      <div className="app">
        <header className="topbar">
          <div className="brand">
            <Tag size={20} />
            <span>vitrine</span>
            <small>anúncios para WhatsApp</small>
          </div>
          <div className={`project-chip ${ws.saveState}`} title={folder ? 'Salvo automaticamente na pasta do projeto' : undefined}>
            <span className="project-chip-path">{folder ? `Anuncios/${folder}` : ws.online ? 'Anúncio sem pasta' : 'Modo navegador'}</span>
            <span className="project-chip-state">{saveLabel}</span>
          </div>
          <nav className="topbar-actions">
            <button type="button" className="btn ghost sm" onClick={ws.actions.loadDemo}>
              Exemplo
            </button>
          </nav>
        </header>

        <ProjectExplorer
          online={ws.online}
          projects={ws.projects}
          current={folder}
          switching={ws.switching}
          saveState={ws.saveState}
          onOpen={ws.actions.open}
          onNew={() => setNewOpen(true)}
          onRefresh={ws.actions.refreshList}
          onReveal={ws.actions.reveal}
          onImport={ws.actions.importFile}
          onExportJson={actions.exportJson}
        />

        {/* key: ao trocar de projeto o painel remonta, zerando estados locais (fotos do assistente, erros). */}
        <aside className="panel" key={ws.session}>
          <AiPanel
            data={data}
            onApply={ws.actions.replaceData}
            folderPhotos={ws.online && folder ? ws.folderImages.images.map((img) => img.url) : null}
            onSetHero={(src) => setHero(update, src)}
            cutout={cutout}
          />
          <HeaderSection data={data} update={update} />
          <DealSection data={data} update={update} />
          {ws.online && folder && (
            <FolderImagesSection
              data={data}
              update={update}
              images={ws.folderImages.images}
              ignored={ws.folderImages.ignored}
              folder={folder}
              onRefresh={ws.actions.refreshFolderImages}
              onReveal={() => ws.actions.reveal(folder)}
            />
          )}
          <ImagesSection data={data} update={update} cutout={cutout} />
          <HighlightsSection data={data} update={update} />
          <ExtrasSection data={data} update={update} />
          <KitSection data={data} update={update} />
          <DeliverySection data={data} update={update} />
          <FinishSection data={data} update={update} />
        </aside>

        <main className="workspace">
          <div className="stage" ref={stageRef}>
            <div
              ref={frameRef}
              className={`stage-frame${heroDrag.hovering ? ' over-hero' : ''}${heroDrag.dragging ? ' dragging-hero' : ''}`}
              style={{ width: AD_WIDTH * scale, height: AD_HEIGHT * scale }}
            >
              <div className="stage-inner" style={{ transform: `scale(${scale})` }}>
                <AdCanvas ref={canvasRef} data={data} />
              </div>
              {(heroDrag.hovering || heroDrag.dragging) && (
                <div className="stage-hint">Arraste para posicionar · roda do mouse: zoom · duplo clique: centralizar</div>
              )}
            </div>
          </div>

          <div className="export-bar">
            <button
              type="button"
              className={`btn primary whatsapp-copy${captionStep ? ' step-2' : ''}`}
              onClick={actions.copyForWhatsApp}
              disabled={exporting}
              title={
                captionStep
                  ? 'Copia a descrição para colar na legenda da imagem'
                  : 'Copia a imagem; no próximo clique, a descrição'
              }
            >
              {exporting ? <Loader2 className="spin" size={16} /> : captionStep ? <MessageSquareText size={16} /> : <ClipboardCopy size={16} />}
              {exporting ? 'Gerando...' : captionStep ? '2. Copiar descrição' : '1. Copiar imagem p/ WhatsApp'}
            </button>
            <button type="button" className="btn" onClick={actions.generate} disabled={exporting}>
              <ImagePlay size={16} /> Gerar imagem
            </button>
            {canShareFiles && (
              <button type="button" className="btn" onClick={actions.share} disabled={exporting}>
                <Share2 size={16} /> Compartilhar
              </button>
            )}
            <button type="button" className="btn ghost" onClick={actions.download} disabled={exporting} title="Baixa uma cópia (também grava na pasta do projeto)">
              <Download size={16} /> Baixar cópia
            </button>
            <div className="export-meta">
              {folder ? (
                <>
                  <span className="export-file">
                    Anuncios/{folder}/anuncio.png
                    <small>{ws.exportedAt ? `gerado ${relativeTime(ws.exportedAt)}` : 'ainda não gerado'}</small>
                  </span>
                  <button type="button" className="btn ghost sm" onClick={() => ws.actions.reveal(folder)}>
                    <FolderInput size={14} /> Abrir pasta
                  </button>
                </>
              ) : (
                <span className="export-file">
                  {AD_WIDTH * EXPORT_PIXEL_RATIO}x{AD_HEIGHT * EXPORT_PIXEL_RATIO} px
                  <small>{ws.online ? 'a pasta é criada ao gerar' : 'modo navegador: a imagem é baixada'}</small>
                </span>
              )}
            </div>
          </div>

          <section className="caption">
            <div className="caption-head">
              <h2>Descrição para o WhatsApp</h2>
              {project.descriptionOverride !== null && (
                <button
                  type="button"
                  className="btn ghost sm"
                  onClick={() => setProject((p) => void (p.descriptionOverride = null))}
                  title="Descarta a edição manual e gera de novo a partir dos campos"
                >
                  <RefreshCw size={14} /> Regenerar
                </button>
              )}
              <button type="button" className="btn sm" onClick={actions.copyText}>
                <Copy size={14} /> Copiar texto
              </button>
            </div>
            <textarea
              className="input caption-text"
              value={description}
              spellCheck={false}
              onChange={(e) => setProject((p) => void (p.descriptionOverride = e.target.value))}
            />
            <p className="caption-foot">
              {project.descriptionOverride !== null ? 'Editada à mão - não acompanha mais os campos.' : 'Gerada dos campos do anúncio.'}{' '}
              *negrito* _itálico_ ~riscado~ viram formatação no WhatsApp.
            </p>
          </section>
        </main>

        {toast && (
          <div className="toast" role="status">
            <Check size={16} /> {toast}
          </div>
        )}

        {newOpen && <NewProjectDialog online={ws.online} onCreate={ws.actions.create} onClose={() => setNewOpen(false)} />}
      </div>
    </AssetContext.Provider>
  );
}
