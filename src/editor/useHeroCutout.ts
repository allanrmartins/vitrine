import { useState } from 'react';
import type { AdData } from '../types.ts';
import { removeBackground, type CutoutProgress } from '../engine/image.ts';
import type { StoreImage } from './assets.tsx';
import type { Update } from './Sections.tsx';

/** Tratamento inicial para uma foto que acabou de virar principal: recortes (PNG transparente) vão soltos. */
export function treatmentFor(src: string): AdData['images']['treatment'] {
  return /recorte|cutout/i.test(decodeURIComponent(src)) ? 'cutout' : 'blend';
}

/** Troca a foto principal (zera ajuste de zoom/posição e o vínculo com um recorte anterior). */
export function setHero(update: Update, src: string) {
  update((d) => {
    d.images.main = src;
    d.images.mainOriginal = null;
    d.images.treatment = treatmentFor(src);
    d.images.transform = { scale: 1, x: 0, y: 0 };
  });
}

/**
 * Remover o fundo da foto principal: recorta sempre a partir da original (recortar de novo não degrada), grava o
 * PNG na pasta do projeto e passa o tratamento para "recortada". "Restaurar" volta para a original.
 */
export function useHeroCutout(data: AdData, update: Update, storeImage: StoreImage) {
  const [progress, setProgress] = useState<CutoutProgress | null>(null);
  const [error, setError] = useState('');
  const main = data.images.main;
  const original = data.images.mainOriginal ?? null;

  const run = async () => {
    if (!main || progress) return;
    const source = original ?? main;
    setError('');
    setProgress({ stage: 'processing' });
    try {
      const url = await storeImage(await removeBackground(source, setProgress), 'principal-recorte');
      update((d) => {
        // Trocou de projeto ou de foto principal durante o recorte: não aplica em cima do que mudou.
        if (d.images.main !== main) return;
        d.images.mainOriginal = source;
        d.images.main = url;
        d.images.treatment = 'cutout';
        d.images.transform = { scale: 1, x: 0, y: 0 };
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao remover o fundo.');
    } finally {
      setProgress(null);
    }
  };

  const restore = () =>
    update((d) => {
      if (!d.images.mainOriginal) return;
      d.images.main = d.images.mainOriginal;
      d.images.mainOriginal = null;
      d.images.treatment = 'blend';
      d.images.transform = { scale: 1, x: 0, y: 0 };
    });

  const label =
    progress?.stage === 'download'
      ? `Baixando modelo ${progress.pct}%`
      : progress
        ? 'Removendo fundo...'
        : original
          ? 'Refazer recorte'
          : 'Remover fundo';

  return { run, restore, busy: progress !== null, label, error, canRestore: !!original, hasMain: !!main };
}

export type HeroCutout = ReturnType<typeof useHeroCutout>;
