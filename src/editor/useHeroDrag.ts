import { useEffect, useRef, useState, type RefObject } from 'react';
import type { AdData } from '../types.ts';
import type { Update } from './Sections.tsx';

/** Limites do ajuste manual da foto hero (os mesmos dos sliders). */
export const HERO_OFFSET_LIMIT = 100;
export const HERO_SCALE_MIN = 0.3;
export const HERO_SCALE_MAX = 3;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const round = (v: number, step: number) => Math.round(v / step) * step;

/**
 * Posicionar a foto hero direto na prévia: arrastar move, roda do mouse dá zoom, duplo clique centraliza.
 * O deslocamento é guardado em % do tamanho da própria foto (é o que o translate() do anúncio usa), então o
 * ajuste vale igual na prévia reduzida e no PNG final.
 */
export function useHeroDrag(frameRef: RefObject<HTMLElement | null>, scale: number, data: AdData, update: Update) {
  const [hovering, setHovering] = useState(false);
  const [dragging, setDragging] = useState(false);
  // Refs: o efeito se inscreve uma vez só (reinscrever no meio do arrasto perderia o arrasto em andamento).
  const transformRef = useRef(data.images.transform);
  transformRef.current = data.images.transform;
  const updateRef = useRef(update);
  updateRef.current = update;
  const scaleRef = useRef(scale);
  scaleRef.current = scale;
  const hasHero = !!data.images.main;

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || !hasHero) {
      setHovering(false);
      return;
    }
    const heroImg = () => frame.querySelector<HTMLImageElement>('.ad-hero img');
    const overHero = (e: { clientX: number; clientY: number }) => {
      const r = heroImg()?.getBoundingClientRect();
      return !!r && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    };

    let drag: { id: number; x: number; y: number; tx: number; ty: number; w: number; h: number } | null = null;

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 || !overHero(e)) return;
      const img = heroImg()!;
      // offsetWidth/Height: tamanho sem o scale() do anúncio nem o da prévia; a base do translate(%).
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, tx: transformRef.current.x, ty: transformRef.current.y, w: img.offsetWidth, h: img.offsetHeight };
      frame.setPointerCapture(e.pointerId);
      setDragging(true);
      e.preventDefault();
    };
    const onMove = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) {
        setHovering(overHero(e));
        return;
      }
      const dx = (e.clientX - drag.x) / scaleRef.current;
      const dy = (e.clientY - drag.y) / scaleRef.current;
      const x = clamp(round(drag.tx + (dx / drag.w) * 100, 0.5), -HERO_OFFSET_LIMIT, HERO_OFFSET_LIMIT);
      const y = clamp(round(drag.ty + (dy / drag.h) * 100, 0.5), -HERO_OFFSET_LIMIT, HERO_OFFSET_LIMIT);
      updateRef.current((d) => {
        d.images.transform.x = x;
        d.images.transform.y = y;
      });
    };
    const onUp = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      drag = null;
      setDragging(false);
      if (frame.hasPointerCapture(e.pointerId)) frame.releasePointerCapture(e.pointerId);
    };
    const onLeave = () => !drag && setHovering(false);
    const onWheel = (e: WheelEvent) => {
      if (!overHero(e)) return;
      e.preventDefault();
      const factor = Math.exp(-e.deltaY * 0.0015);
      const next = clamp(round(transformRef.current.scale * factor, 0.01), HERO_SCALE_MIN, HERO_SCALE_MAX);
      updateRef.current((d) => void (d.images.transform.scale = next));
    };
    const onDouble = (e: MouseEvent) => {
      if (!overHero(e)) return;
      updateRef.current((d) => void (d.images.transform = { scale: 1, x: 0, y: 0 }));
    };

    frame.addEventListener('pointerdown', onDown);
    frame.addEventListener('pointermove', onMove);
    frame.addEventListener('pointerup', onUp);
    frame.addEventListener('pointercancel', onUp);
    frame.addEventListener('pointerleave', onLeave);
    frame.addEventListener('wheel', onWheel, { passive: false });
    frame.addEventListener('dblclick', onDouble);
    return () => {
      frame.removeEventListener('pointerdown', onDown);
      frame.removeEventListener('pointermove', onMove);
      frame.removeEventListener('pointerup', onUp);
      frame.removeEventListener('pointercancel', onUp);
      frame.removeEventListener('pointerleave', onLeave);
      frame.removeEventListener('wheel', onWheel);
      frame.removeEventListener('dblclick', onDouble);
    };
  }, [frameRef, hasHero]);

  return { hovering, dragging };
}
