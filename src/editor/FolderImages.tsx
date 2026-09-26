import { useState } from 'react';
import { FolderInput, LayoutGrid, RefreshCw } from 'lucide-react';
import type { AdData } from '../types.ts';
import type { FolderImage } from '../engine/projects.ts';
import { newExtra, newKitItem } from '../defaults.ts';
import { Section } from './fields.tsx';
import type { Update } from './Sections.tsx';
import { setHero, treatmentFor } from './useHeroCutout.ts';

/** Onde cada imagem aparece no anúncio (para o selo "principal", "kit"...). */
export function imageUsage(ad: AdData): Map<string, string[]> {
  const uses = new Map<string, string[]>();
  const add = (src: string | null | undefined, label: string) => {
    if (!src) return;
    uses.set(src, [...(uses.get(src) ?? []), label]);
  };
  add(ad.images.main, 'principal');
  add(ad.images.secondary[0], 'secundária');
  add(ad.images.secondary[1], 'terciária');
  ad.extras.items.forEach((e) => add(e.image, 'diferencial'));
  ad.kit.items.forEach((k) => add(k.image, 'kit'));
  ad.highlights.items.forEach((h) => h.icon.kind === 'image' && add(h.icon.src, 'ícone'));
  return uses;
}

/**
 * Fotos da pasta imagens/ do projeto (inclusive as copiadas à mão no Explorer), com atalhos para colocá-las no
 * anúncio. É o caminho "sem IA" para montar o anúncio a partir da pasta.
 */
export function FolderImagesSection({
  data,
  update,
  images,
  ignored,
  folder,
  onRefresh,
  onReveal,
}: {
  data: AdData;
  update: Update;
  images: FolderImage[];
  ignored: string[];
  folder: string;
  onRefresh: () => void;
  onReveal: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const uses = imageUsage(data);
  const unused = images.filter((img) => !uses.has(img.url));
  const current = images.find((img) => img.url === selected) ?? null;

  const assign = (fn: (url: string) => void) => {
    if (!current) return;
    fn(current.url);
    setSelected(null);
  };

  /** Preenche principal e secundárias vazias com as fotos ainda não usadas, na ordem da pasta. */
  const distribute = () =>
    update((d) => {
      const queue = images.filter((img) => !uses.has(img.url)).map((img) => img.url);
      if (!d.images.main && queue.length) {
        d.images.main = queue.shift()!;
        d.images.mainOriginal = null;
        d.images.treatment = treatmentFor(d.images.main);
        d.images.transform = { scale: 1, x: 0, y: 0 };
      }
      for (let i = 0; i < 2; i++) if (!d.images.secondary[i] && queue.length) d.images.secondary[i] = queue.shift()!;
    });
  const canDistribute = unused.length > 0 && (!data.images.main || data.images.secondary.some((s) => !s));

  return (
    <Section
      title="Imagens da pasta"
      hint={images.length ? `${images.length} foto${images.length > 1 ? 's' : ''} · ${images.length - unused.length} em uso` : 'vazia'}
      defaultOpen
    >
      <div className="folder-bar">
        <code className="folder-path">Anuncios/{folder}/imagens</code>
        <button type="button" className="icon-btn" aria-label="Atualizar" title="Atualizar (copiou fotos pelo Explorer?)" onClick={onRefresh}>
          <RefreshCw size={14} />
        </button>
        <button type="button" className="icon-btn" aria-label="Abrir pasta" title="Abrir pasta no Explorer" onClick={onReveal}>
          <FolderInput size={14} />
        </button>
      </div>

      {images.length === 0 ? (
        <p className="msg">
          Copie fotos para esta pasta pelo Explorer (ou solte aqui no editor) e elas aparecem sozinhas.
        </p>
      ) : (
        <>
          <div className="folder-grid">
            {images.map((img) => {
              const labels = uses.get(img.url);
              return (
                <button
                  key={img.url}
                  type="button"
                  className={`folder-tile${selected === img.url ? ' on' : ''}${labels ? ' used' : ''}`}
                  title={img.name}
                  aria-pressed={selected === img.url}
                  onClick={() => setSelected((s) => (s === img.url ? null : img.url))}
                >
                  <img src={img.url} alt={img.name} loading="lazy" />
                  {labels && <span className="folder-badge">{labels.join(' · ')}</span>}
                </button>
              );
            })}
          </div>

          {current ? (
            <div className="folder-actions" role="group" aria-label="Usar a foto selecionada como">
              <span className="folder-actions-label">Usar como</span>
              <button
                type="button"
                className="chip"
                onClick={() => assign((url) => setHero(update, url))}
              >
                Principal
              </button>
              <button type="button" className="chip" onClick={() => assign((url) => update((d) => void (d.images.secondary[0] = url)))}>
                Secundária
              </button>
              <button type="button" className="chip" onClick={() => assign((url) => update((d) => void (d.images.secondary[1] = url)))}>
                Terciária
              </button>
              <button type="button" className="chip" onClick={() => assign((url) => update((d) => void d.extras.items.push({ ...newExtra(), image: url })))}>
                + Diferencial
              </button>
              <button type="button" className="chip" onClick={() => assign((url) => update((d) => void d.kit.items.push({ ...newKitItem(), image: url })))}>
                + Item do kit
              </button>
            </div>
          ) : (
            canDistribute && (
              <button type="button" className="btn ghost sm" onClick={distribute}>
                <LayoutGrid size={14} /> Distribuir nas imagens vazias (principal e secundárias)
              </button>
            )
          )}
        </>
      )}
      {ignored.length > 0 && (
        <p className="msg">
          Ignorado{ignored.length > 1 ? 's' : ''} (o navegador não abre este formato): {ignored.join(', ')}. Converta para JPG ou PNG.
        </p>
      )}
    </Section>
  );
}
