import { forwardRef, useState, type CSSProperties } from 'react';
import { Package, Truck } from 'lucide-react';
import type { AdData, IconRef } from '../types.ts';
import { CONDITION_LABELS, deliveryLine, formatBRL } from '../engine/format.ts';
import { ICONS } from './icons.ts';
import { useAutoFit } from './useAutoFit.ts';
import './ad.css';

/** Tamanho lógico do anúncio (16:9). A exportação multiplica pelo pixelRatio. */
export const AD_WIDTH = 1600;
export const AD_HEIGHT = 900;

function FitLine({ className, text, max, min }: { className: string; text: string; max: number; min: number }) {
  const ref = useAutoFit<HTMLDivElement>(max, min, [text]);
  return (
    <div ref={ref} className={`fit-line ${className}`}>
      {text}
    </div>
  );
}

function HighlightIcon({ icon }: { icon: IconRef }) {
  if (icon.kind === 'image') return <img src={icon.src} alt="" />;
  if (icon.kind === 'text') return <span className="ad-icon-text">{icon.value.slice(0, 4)}</span>;
  const { Icon } = ICONS[icon.name] ?? ICONS.check;
  return <Icon strokeWidth={1.6} />;
}

/**
 * A imagem ocupa exatamente a área da foto (sem letterbox), para que a máscara esfumada e a borda do cartão
 * acompanhem as bordas reais da foto. A proporção vem da própria imagem ao carregar.
 */
function HeroImage({ src, transform }: { src: string; transform: string }) {
  const [ratio, setRatio] = useState<{ src: string; r: number } | null>(null);
  const r = ratio?.src === src ? ratio.r : null;
  return (
    <div className="ad-hero-box">
      <img
        src={src}
        alt=""
        onLoad={(e) => setRatio({ src, r: e.currentTarget.naturalWidth / e.currentTarget.naturalHeight })}
        style={{
          transform,
          ...(r ? { aspectRatio: String(r), width: `min(100cqw, calc(100cqh * ${r}))` } : { visibility: 'hidden' }),
        }}
      />
    </div>
  );
}

/**
 * Miniatura quadrada que nunca corta a foto: a imagem inteira fica por cima de uma cópia dela ampliada e
 * desfocada, que preenche as sobras (fotos altas como duas baterias lado a lado, ou largas).
 */
function TileImage({ src }: { src: string }) {
  return (
    <div className="ad-tile-img">
      <img className="ad-tile-backdrop" src={src} alt="" aria-hidden="true" />
      <img className="ad-tile-photo" src={src} alt="" />
    </div>
  );
}

export const AdCanvas = forwardRef<HTMLDivElement, { data: AdData }>(function AdCanvas({ data }, ref) {
  const secondary = data.images.secondary.filter((s): s is string => Boolean(s));
  const highlights = data.highlights.items.filter((h) => h.text.trim() || h.emphasis.trim());
  const extras = data.extras.items.filter((e) => e.text.trim() || e.image);
  const showcase = extras.filter((e) => e.image);
  const kit = data.kit.items.filter((k) => k.label.trim() || k.image);
  const delivery = deliveryLine(data.delivery.modes, data.delivery.location);
  const deliveryNote = data.delivery.note.trim();
  const { scale, x, y } = data.images.transform;

  const leftRef = useAutoFit<HTMLElement>(23, 14, [JSON.stringify(highlights), data.highlights.title, kit.length, showcase.length], 'y');
  const rightRef = useAutoFit<HTMLElement>(24, 15, [JSON.stringify(extras.map((e) => e.text)), data.extras.title], 'y');

  const layout = [
    secondary.length ? '' : 'no-thumbs',
    highlights.length ? '' : 'no-left',
    extras.length ? '' : 'no-right',
    showcase.length || kit.length ? '' : 'no-strip',
    data.images.main ? `hero-${data.images.treatment}` : '',
  ]
    .filter(Boolean)
    .join(' ');

  const style = { '--accent': data.theme.accent, '--hl': data.theme.highlight } as CSSProperties;

  return (
    <div ref={ref} className={`ad ${layout}`} style={style}>
      <div className="ad-bg" />

      {data.images.main && (
        <div className={`ad-hero ${data.images.treatment}`}>
          <div className="ad-hero-glow" />
          <HeroImage src={data.images.main} transform={`translate(${x}%, ${y}%) scale(${scale})`} />
        </div>
      )}

      {secondary.length > 0 && (
        <div className={`ad-thumbs n${secondary.length}`}>
          {secondary.map((src, i) => (
            <div className="ad-thumb" key={i}>
              <img src={src} alt="" />
            </div>
          ))}
        </div>
      )}

      <header className="ad-head">
        {(data.badge.trim() || data.subtitle.trim()) && (
          <div className="ad-kicker">
            {data.badge.trim() && <span className="ad-badge">{data.badge}</span>}
            {data.subtitle.trim() && <FitLine className="ad-subtitle" text={data.subtitle} max={38} min={20} />}
          </div>
        )}
        {data.title.trim() && <FitLine className="ad-title" text={data.title} max={82} min={40} />}
        <div className="ad-deal">
          <div className="ad-condition">
            <span className="ad-condition-label">Condição</span>
            <strong>{CONDITION_LABELS[data.condition.status]}</strong>
            {data.condition.note.trim() && <span className="ad-condition-note">{data.condition.note}</span>}
          </div>
          {data.price.value.trim() && (
            <div className="ad-price-wrap">
              <div className="ad-prices">
                <div className="ad-price">
                  {data.price.label?.trim() && <span className="ad-price-label">{data.price.label}</span>}
                  {data.price.previous.trim() && <span className="ad-price-prev">{formatBRL(data.price.previous)}</span>}
                  <span className="ad-price-value">{formatBRL(data.price.value)}</span>
                </div>
                {data.price.alt?.value.trim() && (
                  <div className="ad-price alt">
                    {data.price.alt.label.trim() && <span className="ad-price-label">{data.price.alt.label}</span>}
                    <span className="ad-price-value">{formatBRL(data.price.alt.value)}</span>
                  </div>
                )}
              </div>
              {data.price.note.trim() && <span className="ad-price-note">{data.price.note}</span>}
            </div>
          )}
        </div>
      </header>

      {highlights.length > 0 && (
        <section className="ad-left" ref={leftRef}>
          {data.highlights.title.trim() && <h3 className="ad-sec-title">{data.highlights.title}</h3>}
          <ul className="ad-highlights">
            {highlights.map((h) => (
              <li key={h.id}>
                <span className="ad-icon">
                  <HighlightIcon icon={h.icon} />
                </span>
                <span className="ad-hl-text">
                  {h.text}
                  {h.emphasis.trim() && <em>{h.emphasis}</em>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {extras.length > 0 && (
        <section className="ad-right" ref={rightRef}>
          {data.extras.title.trim() && <h3 className="ad-sec-title">{data.extras.title}</h3>}
          <ul className="ad-extras">
            {extras.map((e) => e.text.trim() && <li key={e.id}>{e.text}</li>)}
          </ul>
        </section>
      )}

      {(showcase.length > 0 || kit.length > 0) && (
        <section className="ad-strip">
          {showcase.length > 0 && (
            <div className="ad-group">
              <div className="ad-tiles">
                {showcase.map((e) => (
                  <figure className="ad-tile" key={e.id}>
                    <TileImage src={e.image!} />
                    <figcaption>{e.text}</figcaption>
                  </figure>
                ))}
              </div>
            </div>
          )}
          {kit.length > 0 && (
            <div className="ad-group ad-kit">
              <h3 className="ad-kit-title">
                {data.kit.title}
                {data.kit.note.trim() && <small> ({data.kit.note})</small>}
              </h3>
              <div className="ad-tiles">
                {kit.map((k) => (
                  <figure className="ad-tile" key={k.id}>
                    {k.image ? (
                      <TileImage src={k.image} />
                    ) : (
                      <div className="ad-tile-img">
                        <Package strokeWidth={1.4} />
                      </div>
                    )}
                    <figcaption>{k.label}</figcaption>
                  </figure>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      <footer className="ad-foot">
        {(delivery || deliveryNote) && (
          <div className="ad-delivery">
            <Truck strokeWidth={2} />
            <FitLine
              className="ad-delivery-text"
              text={[delivery, deliveryNote && `(${deliveryNote})`].filter(Boolean).join(' ')}
              max={25}
              min={14}
            />
          </div>
        )}
        {data.cta.trim() && (
          <div className="ad-cta">
            <FitLine className="ad-cta-text" text={data.cta} max={34} min={18} />
          </div>
        )}
      </footer>
    </div>
  );
});
