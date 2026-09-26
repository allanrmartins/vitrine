import { describe, expect, it } from 'vitest';
import { demoAd, emptyAd } from '../defaults.ts';
import { fromAiDraft, toAiDraft } from './aiDraft.ts';
import { buildDescription } from './description.ts';
import { deliveryLine, formatBRL, parseBRL, slugify } from './format.ts';
import { collectStrings, mapStrings } from './walk.ts';
import { fileMatchesLabel } from './match.ts';

describe('foto da pasta x item pelo nome', () => {
  it.each([
    ['helice_reserva.png', '1x Jogo de hélices reserva', true],
    ['Helices.jpg', '1x Jogo de hélices reserva', true],
    ['baterias-tattu.jpg', '2x Bateria Tattu 3S 850 mAh HV', true],
    ['filtro nd.jpeg', 'Kit filtros ND SpeedyBee', true],
    ['helice_reserva.png', 'Kit filtros ND SpeedyBee', false],
    ['helice-tattu.png', '1x Jogo de hélices reserva', false],
    ['WhatsApp Image 2026-09-25 at 12.02.49.jpeg', '1x Jogo de hélices reserva', false],
    ['hero.jpeg', 'Hero', true],
    ['123.png', '1x Jogo de hélices', false],
  ])('%s x %s', (file, label, expected) => expect(fileMatchesLabel(file, label)).toBe(expected));
});

describe('nome de pasta', () => {
  it.each([
    ['Cadeira Gamer ThunderX3', 'cadeira-gamer-thunderx3'],
    ['Rotor Riot TANQ 2 + DJI O4 Pro', 'rotor-riot-tanq-2-dji-o4-pro'],
    ['Câmera Sony α7 III — usada', 'camera-sony-7-iii-usada'],
    ['   ', 'anuncio'],
  ])('slugify(%s)', (raw, expected) => expect(slugify(raw)).toBe(expected));
});

describe('caminhos de imagem do projeto', () => {
  it('troca todas as ocorrências sem mexer no resto', () => {
    const ad = demoAd();
    const moved = mapStrings(ad, (s) => (s.startsWith('/demo/') ? s.replace('/demo/', '/anuncios/x/imagens/') : s));
    expect(moved.images.main).toBe('/anuncios/x/imagens/main.png');
    expect(moved.kit.items[0].image).toBe('/anuncios/x/imagens/k-lipo.png');
    expect(moved.title).toBe(ad.title);
    expect(collectStrings(moved, (s) => s.startsWith('/demo/')).size).toBe(0);
    expect(collectStrings(ad, (s) => s.startsWith('/demo/')).size).toBe(11);
  });
});

describe('preço', () => {
  it.each([
    ['3500', 3500],
    ['3.500', 3500],
    ['3.500,90', 3500.9],
    ['R$ 1.234.567', 1234567],
    ['99.9', 99.9],
    ['a combinar', null],
  ])('parseBRL(%s)', (raw, expected) => expect(parseBRL(raw)).toBe(expected));

  it('formata sem centavos quando inteiro', () => {
    expect(formatBRL('3500')).toBe('R$ 3.500');
    expect(formatBRL('3500,5')).toBe('R$ 3.500,50');
    expect(formatBRL('A combinar')).toBe('A combinar');
  });
});

describe('entrega', () => {
  it('encaixa o local na retirada', () => {
    expect(deliveryLine(['comprador', 'retirada'], 'SP')).toBe('Frete por conta do comprador / Retirada em SP');
    expect(deliveryLine(['correios'], 'Campinas')).toBe('Envio pelos Correios / Campinas');
    expect(deliveryLine([], '')).toBe('');
  });
});

describe('descrição do WhatsApp', () => {
  it('monta o exemplo com formatação do WhatsApp', () => {
    const text = buildDescription(demoAd());
    expect(text).toContain('🔥 *VENDE-SE - Rotor Riot TANQ 2 + DJI O4 Pro*');
    expect(text).toContain('💰 *R$ 3.500*');
    expect(text).toContain('🔹 FC GEP-F722-HD v2, ESC TAKER H60_BLS 60A - *Com conformal coating*');
    expect(text).toContain('*O que acompanha (kit completo)*');
    expect(text).toContain('🚚 Frete por conta do comprador / Retirada em SP');
    expect(text).not.toContain('**');
    expect(text).not.toContain('—');
  });

  it('mostra os dois preços com rótulo', () => {
    const ad = demoAd();
    ad.price = { value: '3200', previous: '', note: 'Pix', label: 'Com as baterias', alt: { value: '2700', label: 'Sem as baterias' } };
    const text = buildDescription(ad);
    expect(text).toContain('💰 *R$ 3.200* - Com as baterias\n💰 *R$ 2.700* - Sem as baterias\n💳 Pix');
  });

  it('não deixa seções vazias no anúncio em branco', () => {
    const text = buildDescription(emptyAd());
    expect(text).not.toContain('Destaques');
    expect(text).not.toMatch(/\n{3,}/);
  });
});

describe('rascunho da IA', () => {
  it('ida e volta preserva textos e fotos', () => {
    const ad = demoAd();
    const { draft, photos } = toAiDraft(ad);
    expect(draft.mainPhoto).toBe(1);
    expect(photos[0]).toBe(ad.images.main);
    const back = fromAiDraft(draft, photos, ad);
    expect(back.title).toBe(ad.title);
    expect(back.images.main).toBe(ad.images.main);
    expect(back.images.transform).toEqual(ad.images.transform);
    expect(back.kit.items.map((k) => k.image)).toEqual(ad.kit.items.map((k) => k.image));
    expect(back.highlights.items[3].icon).toEqual({ kind: 'text', value: 'VTX' });
  });

  it('fotos novas ganham os primeiros números', () => {
    const { draft, photos } = toAiDraft(demoAd(), ['data:new-a', 'data:new-b']);
    expect(photos.slice(0, 2)).toEqual(['data:new-a', 'data:new-b']);
    expect(draft.mainPhoto).toBe(3);
  });

  it('ignora referências de foto inexistentes e ícones desconhecidos', () => {
    const base = emptyAd();
    const { draft } = toAiDraft(base);
    draft.mainPhoto = 9;
    draft.highlights.items = [{ icon: 'nao-existe', text: 'x', emphasis: '' }];
    const out = fromAiDraft(draft, [], base);
    expect(out.images.main).toBeNull();
    expect(out.highlights.items[0].icon).toEqual({ kind: 'icon', name: 'check' });
  });
});
