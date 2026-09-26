import type { IconName } from './ad/icons.ts';

/** Ícone de um destaque: ícone da biblioteca, sigla curta (ex.: "VTX") ou imagem enviada. */
export type IconRef =
  | { kind: 'icon'; name: IconName }
  | { kind: 'text'; value: string }
  | { kind: 'image'; src: string };

export interface Highlight {
  id: string;
  icon: IconRef;
  text: string;
  /** Trecho exibido em cor de destaque logo abaixo do texto. */
  emphasis: string;
}

export interface ExtraItem {
  id: string;
  text: string;
  /** Quando presente, o item também aparece na faixa de miniaturas. */
  image: string | null;
}

export interface KitItem {
  id: string;
  label: string;
  image: string | null;
}

export type ConditionStatus = 'novo' | 'lacrado' | 'seminovo' | 'usado-excelente' | 'usado' | 'no-estado';

export type DeliveryMode =
  | 'comprador'
  | 'retirada'
  | 'correios'
  | 'transportadora'
  | 'motoboy'
  | 'gratis'
  | 'combinar';

export type HeroTreatment = 'blend' | 'cutout' | 'card';

export interface HeroTransform {
  scale: number;
  x: number;
  y: number;
}

export interface AdData {
  badge: string;
  subtitle: string;
  title: string;
  price: {
    /** Valor digitado livremente ("3500", "3.500,00"); formatado na renderização. */
    value: string;
    previous: string;
    note: string;
    /** Rótulo opcional do preço principal (ex.: "Com as baterias"). */
    label?: string;
    /** Segundo preço, em caixa própria ao lado do principal (ex.: 2700 "Sem as baterias"). */
    alt?: { value: string; label: string };
  };
  condition: {
    status: ConditionStatus;
    note: string;
  };
  images: {
    main: string | null;
    /** Foto de onde saiu o recorte atual da principal (para "Restaurar original"); ausente se não houve recorte. */
    mainOriginal?: string | null;
    treatment: HeroTreatment;
    transform: HeroTransform;
    secondary: (string | null)[];
  };
  highlights: {
    title: string;
    items: Highlight[];
  };
  extras: {
    title: string;
    items: ExtraItem[];
  };
  kit: {
    title: string;
    note: string;
    items: KitItem[];
  };
  delivery: {
    modes: DeliveryMode[];
    location: string;
    note: string;
  };
  cta: string;
  theme: {
    accent: string;
    highlight: string;
  };
}

/** Projeto salvo: dados do anúncio + descrição do WhatsApp (quando editada à mão). */
export interface Project {
  version: 1;
  data: AdData;
  descriptionOverride: string | null;
}
