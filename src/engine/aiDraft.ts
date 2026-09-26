import type { AdData, ConditionStatus, DeliveryMode, HeroTreatment, IconRef } from '../types.ts';
import { ICON_NAMES, isIconName } from '../ad/icons.ts';
import { CONDITION_LABELS, DELIVERY_LABELS } from './format.ts';
import { uid } from '../defaults.ts';

/**
 * Formato que a IA (Claude ou Gemini) lê e devolve: os textos do anúncio, com imagens trocadas por índices de
 * foto (foto-1, foto-2...). Isso mantém o JSON pequeno e deixa a IA escolher qual foto vai onde.
 */
export interface AiDraft {
  badge: string;
  subtitle: string;
  title: string;
  price: { value: string; previous: string; note: string; label: string; altValue: string; altLabel: string };
  condition: { status: ConditionStatus; note: string };
  mainPhoto: number | null;
  secondaryPhotos: number[];
  treatment: HeroTreatment;
  highlights: { title: string; items: { icon: string; text: string; emphasis: string }[] };
  extras: { title: string; items: { text: string; photo: number | null }[] };
  kit: { title: string; note: string; items: { label: string; photo: number | null }[] };
  delivery: { modes: DeliveryMode[]; location: string; note: string };
  cta: string;
  accent: string | null;
}

export interface AiResult {
  draft: AiDraft;
  /** Observações da IA para o usuário (dúvidas, dados que faltaram). */
  notes: string;
}

/** CLIs de IA que o editor sabe usar. */
export type ProviderId = 'claude' | 'gemini';
export const PROVIDER_NAMES: Record<ProviderId, string> = { claude: 'Claude', gemini: 'Gemini' };

export interface ProviderStatus {
  id: ProviderId;
  installed: boolean;
  /** Instalado e com login que funciona. */
  ready: boolean;
  /** Frase para o usuário: como está logado, ou o que falta fazer. */
  detail: string;
}

/** Resposta de GET /api/ia. `active` é a IA usada quando o pedido não escolhe uma. */
export interface AiStatus {
  active: ProviderId | null;
  providers: ProviderStatus[];
}

export type AiRequest = {
  mode: 'generate' | 'tweak';
  instruction: string;
  photos: string[];
  draft: AiDraft;
  /** IA escolhida no editor; sem ela (ou se não estiver pronta), vale a `active`. */
  provider?: ProviderId;
};

export interface RunInfo {
  provider: ProviderId;
  durationMs: number;
  costUsd: number | null;
}

const str = { type: 'string' } as const;
const photoRef = { type: ['integer', 'null'], minimum: 1 } as const;
const obj = (properties: Record<string, unknown>) => ({
  type: 'object',
  additionalProperties: false,
  required: Object.keys(properties),
  properties,
});

export const AI_RESULT_SCHEMA = obj({
  notes: { type: 'string', description: 'Observações curtas para o vendedor: dúvidas ou dados que faltaram. Vazio se nada.' },
  draft: obj({
    badge: str,
    subtitle: str,
    title: str,
    price: obj({
      value: str,
      previous: str,
      note: str,
      label: { type: 'string', description: 'Rótulo do preço principal quando há duas opções (ex.: "Com as baterias"); vazio se só há um preço.' },
      altValue: { type: 'string', description: 'Segundo preço, só o número (ex.: "2700"); vazio se não houver.' },
      altLabel: { type: 'string', description: 'O que muda no segundo preço (ex.: "Sem as baterias").' },
    }),
    condition: obj({ status: { enum: Object.keys(CONDITION_LABELS) }, note: str }),
    mainPhoto: photoRef,
    secondaryPhotos: { type: 'array', items: { type: 'integer', minimum: 1 }, maxItems: 2 },
    treatment: { enum: ['blend', 'cutout', 'card'] },
    highlights: obj({
      title: str,
      items: {
        type: 'array',
        maxItems: 6,
        items: obj({
          icon: { type: 'string', description: `Um de: ${ICON_NAMES.join(', ')}; ou "txt:SIGLA" (até 4 letras); ou "photo:N".` },
          text: str,
          emphasis: str,
        }),
      },
    }),
    extras: obj({ title: str, items: { type: 'array', maxItems: 8, items: obj({ text: str, photo: photoRef }) } }),
    kit: obj({ title: str, note: str, items: { type: 'array', maxItems: 6, items: obj({ label: str, photo: photoRef }) } }),
    delivery: obj({
      modes: { type: 'array', items: { enum: Object.keys(DELIVERY_LABELS) } },
      location: str,
      note: str,
    }),
    cta: str,
    accent: { type: ['string', 'null'], pattern: '^#[0-9A-Fa-f]{6}$' },
  }),
});

/** Registro de fotos: cada imagem distinta ganha um número estável (1-based). */
class PhotoIndex {
  readonly photos: string[] = [];
  ref(src: string | null): number | null {
    if (!src) return null;
    const i = this.photos.indexOf(src);
    if (i >= 0) return i + 1;
    this.photos.push(src);
    return this.photos.length;
  }
}

function iconToString(icon: IconRef, index: PhotoIndex): string {
  if (icon.kind === 'icon') return icon.name;
  if (icon.kind === 'text') return `txt:${icon.value}`;
  return `photo:${index.ref(icon.src)}`;
}

function iconFromString(value: string, photos: string[]): IconRef {
  if (value.startsWith('txt:')) return { kind: 'text', value: value.slice(4, 8) };
  if (value.startsWith('photo:')) {
    const src = photos[Number(value.slice(6)) - 1];
    if (src) return { kind: 'image', src };
  }
  return { kind: 'icon', name: isIconName(value) ? value : 'check' };
}

/** AdData -> rascunho para a IA. `leadPhotos` (fotos novas) recebem os primeiros números. */
export function toAiDraft(ad: AdData, leadPhotos: string[] = []): { draft: AiDraft; photos: string[] } {
  const index = new PhotoIndex();
  leadPhotos.forEach((p) => index.ref(p));
  const draft: AiDraft = {
    badge: ad.badge,
    subtitle: ad.subtitle,
    title: ad.title,
    price: {
      value: ad.price.value,
      previous: ad.price.previous,
      note: ad.price.note,
      label: ad.price.label ?? '',
      altValue: ad.price.alt?.value ?? '',
      altLabel: ad.price.alt?.label ?? '',
    },
    condition: { ...ad.condition },
    mainPhoto: index.ref(ad.images.main),
    secondaryPhotos: ad.images.secondary.map((s) => index.ref(s)).filter((n): n is number => n !== null),
    treatment: ad.images.treatment,
    highlights: {
      title: ad.highlights.title,
      items: ad.highlights.items.map((h) => ({ icon: iconToString(h.icon, index), text: h.text, emphasis: h.emphasis })),
    },
    extras: { title: ad.extras.title, items: ad.extras.items.map((e) => ({ text: e.text, photo: index.ref(e.image) })) },
    kit: {
      title: ad.kit.title,
      note: ad.kit.note,
      items: ad.kit.items.map((k) => ({ label: k.label, photo: index.ref(k.image) })),
    },
    delivery: { ...ad.delivery, modes: [...ad.delivery.modes] },
    cta: ad.cta,
    accent: ad.theme.accent,
  };
  return { draft, photos: index.photos };
}

/** Rascunho da IA -> AdData, preservando o que a IA não controla (ajuste fino da imagem, cor de destaque). */
export function fromAiDraft(draft: AiDraft, photos: string[], base: AdData): AdData {
  const photo = (n: number | null) => (n ? (photos[n - 1] ?? null) : null);
  const secondary = draft.secondaryPhotos.map(photo).filter((s): s is string => Boolean(s)).slice(0, 2);
  const main = photo(draft.mainPhoto);
  return {
    badge: draft.badge,
    subtitle: draft.subtitle,
    title: draft.title,
    price: {
      value: draft.price.value,
      previous: draft.price.previous,
      note: draft.price.note,
      label: draft.price.label,
      alt: draft.price.altValue.trim() ? { value: draft.price.altValue, label: draft.price.altLabel } : undefined,
    },
    condition: { status: draft.condition.status in CONDITION_LABELS ? draft.condition.status : base.condition.status, note: draft.condition.note },
    images: {
      main,
      mainOriginal: main === base.images.main ? (base.images.mainOriginal ?? null) : null,
      treatment: draft.treatment,
      transform: main === base.images.main ? base.images.transform : { scale: 1, x: 0, y: 0 },
      secondary: [secondary[0] ?? null, secondary[1] ?? null],
    },
    highlights: {
      title: draft.highlights.title,
      items: draft.highlights.items.map((h) => ({ id: uid(), icon: iconFromString(h.icon, photos), text: h.text, emphasis: h.emphasis })),
    },
    extras: { title: draft.extras.title, items: draft.extras.items.map((e) => ({ id: uid(), text: e.text, image: photo(e.photo) })) },
    kit: {
      title: draft.kit.title,
      note: draft.kit.note,
      items: draft.kit.items.map((k) => ({ id: uid(), label: k.label, image: photo(k.photo) })),
    },
    delivery: {
      modes: draft.delivery.modes.filter((m) => m in DELIVERY_LABELS),
      location: draft.delivery.location,
      note: draft.delivery.note,
    },
    cta: draft.cta,
    theme: { ...base.theme, accent: draft.accent ?? base.theme.accent },
  };
}
