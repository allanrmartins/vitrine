import type { AdData } from '../types.ts';
import { CONDITION_LABELS, deliveryLine, formatBRL } from './format.ts';

/** Negrito do WhatsApp; ignora texto vazio para não gerar "**". */
const b = (s: string) => (s.trim() ? `*${s.trim()}*` : '');
const i = (s: string) => (s.trim() ? `_${s.trim()}_` : '');
const s = (t: string) => (t.trim() ? `~${t.trim()}~` : '');

/** Gera a legenda do anúncio no formato do WhatsApp (*negrito*, _itálico_, ~riscado~). */
export function buildDescription(ad: AdData): string {
  const blocks: string[][] = [];

  const head: string[] = [];
  const top = [ad.badge.trim().toUpperCase(), ad.title.trim()].filter(Boolean).join(' - ');
  if (top) head.push(`🔥 ${b(top)}`);
  if (ad.subtitle.trim()) head.push(i(ad.subtitle));
  blocks.push(head);

  const deal: string[] = [];
  if (ad.price.value.trim()) {
    const prev = ad.price.previous.trim() ? ` ${s(formatBRL(ad.price.previous))}` : '';
    const label = ad.price.label?.trim() ? ` - ${ad.price.label.trim()}` : '';
    deal.push(`💰 ${b(formatBRL(ad.price.value))}${prev}${label}`);
  }
  const alt = ad.price.alt;
  if (alt?.value.trim()) {
    deal.push(`💰 ${b(formatBRL(alt.value))}${alt.label.trim() ? ` - ${alt.label.trim()}` : ''}`);
  }
  if (ad.price.note.trim()) deal.push(`💳 ${ad.price.note.trim()}`);
  const cond = [CONDITION_LABELS[ad.condition.status], ad.condition.note.trim()].filter(Boolean).join(' - ');
  deal.push(`🏷️ Condição: ${b(cond)}`);
  blocks.push(deal);

  const highlights = ad.highlights.items.filter((h) => h.text.trim() || h.emphasis.trim());
  if (highlights.length) {
    blocks.push([
      b(ad.highlights.title || 'Destaques'),
      ...highlights.map((h) => `🔹 ${[h.text.trim(), b(h.emphasis)].filter(Boolean).join(' - ')}`),
    ]);
  }

  const extras = ad.extras.items.filter((e) => e.text.trim());
  if (extras.length) {
    blocks.push([b(ad.extras.title || 'Extras'), ...extras.map((e) => `✅ ${e.text.trim()}`)]);
  }

  const kit = ad.kit.items.filter((k) => k.label.trim());
  if (kit.length) {
    const title = [ad.kit.title.trim() || 'O que acompanha', ad.kit.note.trim() && `(${ad.kit.note.trim()})`]
      .filter(Boolean)
      .join(' ');
    blocks.push([b(title), ...kit.map((k) => `📦 ${k.label.trim()}`)]);
  }

  const delivery: string[] = [];
  const line = deliveryLine(ad.delivery.modes, ad.delivery.location);
  if (line) delivery.push(`🚚 ${line}`);
  if (ad.delivery.note.trim()) delivery.push(`📍 ${ad.delivery.note.trim()}`);
  blocks.push(delivery);

  if (ad.cta.trim()) blocks.push([`👉 ${b(ad.cta)}`]);

  return blocks
    .map((lines) => lines.filter(Boolean))
    .filter((lines) => lines.length)
    .map((lines) => lines.join('\n'))
    .join('\n\n');
}
