import { slugify } from './format.ts';

/** Palavras que não identificam o item ("1x Jogo de hélices" -> hélices). */
const STOPWORDS = new Set(['de', 'da', 'do', 'das', 'dos', 'com', 'sem', 'e', 'a', 'o', 'as', 'os', 'para', 'p', 'kit', 'jogo', 'par', 'foto', 'img', 'imagem']);

/** Palavras significativas, sem acento e no singular aproximado ("hélices" -> "helice", "baterias" -> "bateria"). */
export function keywords(text: string): string[] {
  return slugify(text)
    .split('-')
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w) && !/^\d+x?$/.test(w))
    .map((w) => (w.length > 4 && w.endsWith('s') ? w.slice(0, -1) : w));
}

const same = (a: string, b: string) => a === b || (a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a)));

/**
 * O nome do arquivo (sem extensão) combina com o rótulo do item? Todas as palavras do arquivo precisam aparecer
 * no rótulo: "helice_reserva" combina com "1x Jogo de hélices reserva", mas "helice" sozinho não combina com
 * "Kit filtros ND" e nomes genéricos ("WhatsApp Image 2026...") não combinam com nada.
 */
export function fileMatchesLabel(fileName: string, label: string): boolean {
  const base = fileName.replace(/\.[a-z0-9]+$/i, '');
  if (/^(whatsapp|img|image|dsc|pxl|photo|screenshot|captura)/i.test(base)) return false;
  const fileWords = keywords(base);
  const labelWords = keywords(label);
  if (!fileWords.length || !labelWords.length) return false;
  return fileWords.every((fw) => labelWords.some((lw) => same(fw, lw)));
}
