import type { ConditionStatus, DeliveryMode } from '../types.ts';

export const CONDITION_LABELS: Record<ConditionStatus, string> = {
  novo: 'Novo',
  lacrado: 'Novo lacrado',
  seminovo: 'Seminovo',
  'usado-excelente': 'Usado - excelente estado',
  usado: 'Usado',
  'no-estado': 'No estado (para peças)',
};

export const DELIVERY_LABELS: Record<DeliveryMode, string> = {
  comprador: 'Frete por conta do comprador',
  retirada: 'Retirada em mãos',
  correios: 'Envio pelos Correios',
  transportadora: 'Envio por transportadora',
  motoboy: 'Entrega via motoboy / app',
  gratis: 'Frete grátis',
  combinar: 'Entrega a combinar',
};

/** Converte texto livre ("3500", "3.500", "3.500,90", "R$ 3500.9") em número. */
export function parseBRL(raw: string): number | null {
  const cleaned = raw.replace(/[^\d.,]/g, '');
  if (!/\d/.test(cleaned)) return null;
  let normalized: string;
  if (cleaned.includes(',')) {
    normalized = cleaned.replace(/\./g, '').replace(',', '.');
  } else {
    // Sem vírgula: ponto seguido de exatamente 3 dígitos é separador de milhar.
    normalized = /\.\d{3}(\.|$)/.test(cleaned) ? cleaned.replace(/\./g, '') : cleaned;
  }
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

/** "R$ 3.500" para valores inteiros, "R$ 3.500,90" com centavos. Texto não numérico passa direto. */
export function formatBRL(raw: string): string {
  const value = parseBRL(raw);
  if (value === null) return raw.trim();
  const cents = !Number.isInteger(value);
  const body = value.toLocaleString('pt-BR', {
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  });
  return `R$ ${body}`;
}

export function deliveryLine(modes: DeliveryMode[], location: string): string {
  const parts = modes.map((m) => DELIVERY_LABELS[m]);
  const loc = location.trim();
  if (loc) {
    const i = modes.indexOf('retirada');
    if (i >= 0) parts[i] = `Retirada em ${loc}`;
    else parts.push(loc);
  }
  return parts.join(' / ');
}

/** Nome seguro para arquivo/pasta: sem acento, minúsculo, com hífens. */
export function slugify(text: string): string {
  return (
    text
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'anuncio'
  );
}

const rtf = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto', style: 'short' });

/** "agora", "há 5 min", "ontem", ou a data. */
export function relativeTime(iso: string, now = Date.now()): string {
  const s = Math.round((new Date(iso).getTime() - now) / 1000);
  const abs = Math.abs(s);
  if (abs < 45) return 'agora';
  if (abs < 3600) return rtf.format(Math.round(s / 60), 'minute');
  if (abs < 86_400) return rtf.format(Math.round(s / 3600), 'hour');
  if (abs < 7 * 86_400) return rtf.format(Math.round(s / 86_400), 'day');
  return new Date(iso).toLocaleDateString('pt-BR');
}
