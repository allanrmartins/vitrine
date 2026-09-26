import type { AdData, Highlight, ExtraItem, KitItem } from './types.ts';

export const uid = () => Math.random().toString(36).slice(2, 10);

export const ACCENTS = [
  { name: 'Vermelho', accent: '#E3262E', highlight: '#FFC53D' },
  { name: 'Laranja', accent: '#F26B1D', highlight: '#FFE14D' },
  { name: 'Verde', accent: '#1FAE5B', highlight: '#D7F75B' },
  { name: 'Azul', accent: '#1F6FEB', highlight: '#5CE1E6' },
  { name: 'Roxo', accent: '#7C3AED', highlight: '#F0ABFC' },
  { name: 'Dourado', accent: '#C9962B', highlight: '#FFF1B8' },
];

export const BADGE_PRESETS = ['VENDE-SE', 'VENDO', 'OPORTUNIDADE', 'BAIXOU!', 'NOVO', 'TROCO'];

export const newHighlight = (): Highlight => ({ id: uid(), icon: { kind: 'icon', name: 'check' }, text: '', emphasis: '' });
export const newExtra = (): ExtraItem => ({ id: uid(), text: '', image: null });
export const newKitItem = (): KitItem => ({ id: uid(), label: '', image: null });

export function emptyAd(): AdData {
  return {
    badge: 'VENDE-SE',
    subtitle: '',
    title: '',
    price: { value: '', previous: '', note: '' },
    condition: { status: 'seminovo', note: '' },
    images: { main: null, treatment: 'blend', transform: { scale: 1, x: 0, y: 0 }, secondary: [null, null] },
    highlights: { title: 'Destaques', items: [newHighlight()] },
    extras: { title: 'Diferenciais', items: [] },
    kit: { title: 'O que acompanha', note: '', items: [] },
    delivery: { modes: ['comprador', 'retirada'], location: '', note: '' },
    cta: 'Interessados chamar no DM!',
    theme: { accent: ACCENTS[0].accent, highlight: ACCENTS[0].highlight },
  };
}

const demo = (file: string) => `/demo/${file}`;

/** Anúncio de exemplo (o drone FPV do layout original). */
export function demoAd(): AdData {
  return {
    badge: 'VENDE-SE',
    subtitle: 'FPV 5" 6S - Pronto para voar',
    title: 'Rotor Riot TANQ 2 + DJI O4 Pro',
    price: { value: '3500', previous: '', note: 'Pix ou cartão (juros por conta do comprador)' },
    condition: { status: 'usado-excelente', note: 'poucos voos, sem quedas fortes' },
    images: {
      main: demo('main.png'),
      treatment: 'blend',
      transform: { scale: 1, x: 0, y: 0 },
      secondary: [demo('secondary.png'), null],
    },
    highlights: {
      title: 'Destaques do build',
      items: [
        { id: uid(), icon: { kind: 'icon', name: 'frame' }, text: 'Frame Rotor Riot TANQ 2 5" (220 mm, braços 8 mm)', emphasis: '' },
        { id: uid(), icon: { kind: 'icon', name: 'cpu' }, text: 'FC GEP-F722-HD v2, ESC TAKER H60_BLS 60A', emphasis: 'Com conformal coating' },
        { id: uid(), icon: { kind: 'icon', name: 'motor' }, text: 'Motores GEPRC SPEEDX2 2207E 1960KV', emphasis: '' },
        { id: uid(), icon: { kind: 'text', value: 'VTX' }, text: 'DJI O4 Air Unit Pro', emphasis: '' },
      ],
    },
    extras: {
      title: 'Customizações e TPU',
      items: [
        { id: uid(), text: 'TPUs personalizados', image: demo('x-tpu.png') },
        { id: uid(), text: 'LEDs embutidos nos squids', image: demo('x-led.png') },
        { id: uid(), text: 'GPS+VTX em peça única', image: demo('x-gps.png') },
        { id: uid(), text: 'ELRS 2.4', image: demo('x-elrs.png') },
        { id: uid(), text: 'Buzzer autônomo 70 dB com botão', image: demo('x-buzzer.png') },
      ],
    },
    kit: {
      title: 'O que acompanha',
      note: 'kit completo',
      items: [
        { id: uid(), label: '1x Lipo 6s CNHL 1100 mAh', image: demo('k-lipo.png') },
        { id: uid(), label: '1x Jogo de props Gemfan-Vanover 5136', image: demo('k-props.png') },
        { id: uid(), label: 'Filtro ND8 Speedybee', image: demo('k-nd8.png') },
        { id: uid(), label: 'Fita LED 24V', image: demo('k-led.png') },
      ],
    },
    delivery: { modes: ['comprador', 'retirada'], location: 'SP', note: 'Localizado em São Paulo' },
    cta: 'Interessados chamar no DM!',
    theme: { accent: ACCENTS[0].accent, highlight: ACCENTS[0].highlight },
  };
}
