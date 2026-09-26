import { getFontEmbedCSS, toSvg } from 'html-to-image';
import { AD_HEIGHT, AD_WIDTH } from '../ad/AdCanvas.tsx';

/** Resolução final: 2400x1350. O WhatsApp recomprime, então partir de uma imagem nítida faz diferença. */
export const EXPORT_PIXEL_RATIO = 1.5;

let fontCSS: Promise<string> | null = null;

/** Espera por load/error, nunca por decode() ou requestAnimationFrame: os dois não andam com a aba em segundo plano. */
function whenLoaded(img: HTMLImageElement): Promise<void> {
  if (img.complete) return Promise.resolve();
  return new Promise((resolve) => {
    img.addEventListener('load', () => resolve(), { once: true });
    img.addEventListener('error', () => resolve(), { once: true });
  });
}

function loadSvg(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('O navegador não conseguiu montar a imagem do anúncio.'));
    img.src = url;
  });
}

/**
 * Rasteriza o anúncio a partir do nó DOM do canvas (em tamanho real, sem a escala da pré-visualização).
 * O html-to-image só monta o SVG; a rasterização é feita aqui porque a dele espera requestAnimationFrame e fica
 * travada para sempre se o usuário trocar de aba durante a exportação.
 */
export async function renderAdPng(node: HTMLElement): Promise<Blob> {
  await document.fonts.ready;
  await Promise.all(Array.from(node.querySelectorAll('img')).map(whenLoaded));
  fontCSS ??= getFontEmbedCSS(node);
  const options = {
    width: AD_WIDTH,
    height: AD_HEIGHT,
    fontEmbedCSS: await fontCSS,
    cacheBust: false,
    style: { transform: 'none', margin: '0' },
  };
  // A primeira passada aquece o cache de imagens do html-to-image; sem ela o Safari às vezes sai sem imagens.
  await toSvg(node, options);
  const svg = await loadSvg(await toSvg(node, options));

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(AD_WIDTH * EXPORT_PIXEL_RATIO);
  canvas.height = Math.round(AD_HEIGHT * EXPORT_PIXEL_RATIO);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas indisponível neste navegador.');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(svg, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Falha ao gerar a imagem.');
  return blob;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
