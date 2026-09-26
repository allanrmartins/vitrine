/** Lê um arquivo de imagem, reduz para no máximo `maxSide` px e devolve data URL (PNG se tiver transparência). */
export async function fileToDataUrl(file: Blob, maxSide = 1800): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const ratio = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * ratio);
  const h = Math.round(bitmap.height * ratio);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const alpha = file.type === 'image/png' || file.type === 'image/webp' ? hasTransparency(ctx, w, h) : false;
  return alpha ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.9);
}

function hasTransparency(ctx: CanvasRenderingContext2D, w: number, h: number): boolean {
  const { data } = ctx.getImageData(0, 0, w, h);
  for (let i = 3; i < data.length; i += 16) if (data[i] < 250) return true;
  return false;
}

export async function urlToBlob(url: string): Promise<Blob> {
  const res = await fetch(url);
  return res.blob();
}

/**
 * Corta as bordas transparentes (mais uma folga de `pad` do lado maior). Sem isso, um recorte feito de foto
 * vertical continua com o tamanho da foto inteira e o objeto fica pequeno no anúncio.
 * Pixels com alfa abaixo de `threshold` contam como vazio (sobras semitransparentes do recorte).
 */
export function trimTransparent(canvas: HTMLCanvasElement, pad = 0.03, threshold = 12): HTMLCanvasElement {
  const { width: w, height: h } = canvas;
  const { data } = canvas.getContext('2d')!.getImageData(0, 0, w, h);
  let top = h;
  let left = w;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] < threshold) continue;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      bottom = y;
    }
  }
  if (right < 0) return canvas; // tudo transparente: devolve como está
  const margin = Math.round(Math.max(right - left, bottom - top) * pad);
  left = Math.max(0, left - margin);
  top = Math.max(0, top - margin);
  right = Math.min(w - 1, right + margin);
  bottom = Math.min(h - 1, bottom + margin);
  const out = document.createElement('canvas');
  out.width = right - left + 1;
  out.height = bottom - top + 1;
  out.getContext('2d')!.drawImage(canvas, left, top, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}

export type CutoutProgress = { stage: 'download'; pct: number } | { stage: 'processing' };

/**
 * Remove o fundo no próprio navegador (modelo baixado sob demanda, ~40 MB só na primeira vez) e corta as bordas
 * vazias. Devolve PNG em data URL, no máximo 2000 px no lado maior.
 */
export async function removeBackground(src: string, onProgress?: (p: CutoutProgress) => void): Promise<string> {
  const { removeBackground: run } = await import('@imgly/background-removal');
  let downloading = false;
  const blob = await run(await urlToBlob(src), {
    output: { format: 'image/png' },
    progress: (key, current, total) => {
      if (key.startsWith('fetch') && total && current < total) {
        downloading = true;
        onProgress?.({ stage: 'download', pct: Math.round((current / total) * 100) });
      } else if (downloading || key.startsWith('compute')) {
        onProgress?.({ stage: 'processing' });
      }
    },
  });
  onProgress?.({ stage: 'processing' });
  const bitmap = await createImageBitmap(blob);
  const full = document.createElement('canvas');
  full.width = bitmap.width;
  full.height = bitmap.height;
  full.getContext('2d')!.drawImage(bitmap, 0, 0);
  bitmap.close();
  const trimmed = trimTransparent(full);
  const out = await new Promise<Blob>((resolve, reject) =>
    trimmed.toBlob((b) => (b ? resolve(b) : reject(new Error('Falha ao gerar o PNG recortado.'))), 'image/png'),
  );
  return fileToDataUrl(new File([out], 'recorte.png', { type: 'image/png' }), 2000);
}
