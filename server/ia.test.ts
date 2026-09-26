import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { demoAd } from '../src/defaults.ts';
import { toAiDraft, type ProviderStatus } from '../src/engine/aiDraft.ts';
import { checkResult, explainGeminiError, extractJson, geminiAuthMethod } from './gemini.ts';
import { forcedProvider, pickProvider } from './ia.ts';

const st = (id: ProviderStatus['id'], ready: boolean): ProviderStatus => ({ id, installed: true, ready, detail: '' });

describe('escolha da IA', () => {
  it('prefere o Claude quando os dois estão prontos', () => {
    expect(pickProvider([st('claude', true), st('gemini', true)], null)).toBe('claude');
  });
  it('usa o Gemini quando só ele está pronto', () => {
    expect(pickProvider([st('claude', false), st('gemini', true)], null)).toBe('gemini');
  });
  it('respeita VITRINE_IA e o pedido do editor, se estiverem prontos', () => {
    const both = [st('claude', true), st('gemini', true)];
    expect(pickProvider(both, 'gemini')).toBe('gemini');
    expect(pickProvider(both, 'gemini', 'claude')).toBe('claude');
    expect(pickProvider([st('claude', true), st('gemini', false)], 'gemini', 'gemini')).toBe('claude');
  });
  it('devolve null sem nenhuma pronta', () => {
    expect(pickProvider([st('claude', false), st('gemini', false)], null)).toBeNull();
  });
  it('lê VITRINE_IA sem diferenciar maiúsculas', () => {
    expect(forcedProvider({ VITRINE_IA: ' Gemini ' })).toBe('gemini');
    expect(forcedProvider({ VITRINE_IA: 'gpt' })).toBeNull();
    expect(forcedProvider({})).toBeNull();
  });
});

describe('login do Gemini CLI', () => {
  let home = '';
  afterEach(() => home && rmSync(home, { recursive: true, force: true }));
  const fakeHome = (files: Record<string, string>) => {
    home = mkdtempSync(path.join(os.tmpdir(), 'vitrine-home-'));
    mkdirSync(path.join(home, '.gemini'));
    for (const [name, body] of Object.entries(files)) writeFileSync(path.join(home, name), body);
    return home;
  };

  it('sem nada configurado, não há login', () => {
    expect(geminiAuthMethod({}, fakeHome({}))).toBeNull();
  });
  it('acha a chave na variável de ambiente ou no ~/.gemini/.env', () => {
    expect(geminiAuthMethod({ GEMINI_API_KEY: 'x' }, fakeHome({}))).toBe('chave de API');
    rmSync(home, { recursive: true, force: true });
    expect(geminiAuthMethod({}, fakeHome({ '.gemini/.env': 'GEMINI_API_KEY="abc"\n' }))).toBe('chave de API');
  });
  it('lê o tipo escolhido no settings.json (chave guardada no cofre do sistema)', () => {
    const settings = JSON.stringify({ security: { auth: { selectedType: 'gemini-api-key' } } });
    expect(geminiAuthMethod({}, fakeHome({ '.gemini/settings.json': settings }))).toBe('chave de API');
  });
  it('o tipo escolhido no settings.json vale mais que a variável, como no próprio CLI', () => {
    const settings = JSON.stringify({ security: { auth: { selectedType: 'oauth-personal' } } });
    expect(geminiAuthMethod({ GEMINI_API_KEY: 'x' }, fakeHome({ '.gemini/settings.json': settings }))).toBe('conta Google');
  });
  it('reconhece o login com conta Google', () => {
    const settings = JSON.stringify({ security: { auth: { selectedType: 'oauth-personal' } } });
    expect(geminiAuthMethod({}, fakeHome({ '.gemini/settings.json': settings }))).toBe('conta Google');
  });
  it('explica a recusa da conta pessoal pelo Google', () => {
    const msg = explainGeminiError('IneligibleTierError: This client is no longer supported for Gemini Code Assist for individuals.');
    expect(msg).toMatch(/aistudio\.google\.com\/apikey/);
    expect(msg).toMatch(/GEMINI_API_KEY/);
    expect(msg).toMatch(/\/auth/);
  });
});

describe('resposta do Gemini', () => {
  const valid = { notes: '', draft: toAiDraft(demoAd()).draft };
  // Fotos viram índices; o demo usa URLs, então o rascunho já sai com números.
  const text = JSON.stringify(valid);

  it('aceita JSON puro, com cercas ou com frase antes', () => {
    expect(extractJson(text)).toEqual(valid);
    expect(extractJson('```json\n' + text + '\n```')).toEqual(valid);
    expect(extractJson('Aqui está o anúncio:\n' + text)).toEqual(valid);
  });
  it('valida contra o mesmo schema do Claude', () => {
    expect(checkResult(text)).toEqual({ ok: true, result: valid });
    const broken = JSON.stringify({ ...valid, draft: { ...valid.draft, treatment: 'neon' } });
    const res = checkResult(broken);
    expect(res.ok).toBe(false);
    expect(!res.ok && res.errors).toMatch(/treatment/);
  });
  it('aponta resposta sem JSON', () => {
    expect(checkResult('Não consegui ver as fotos.')).toEqual({ ok: false, errors: 'a resposta não tem um objeto JSON' });
  });
});
