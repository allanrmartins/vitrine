import { existsSync, readFileSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Ajv } from 'ajv';
import { AI_RESULT_SCHEMA, type AiRequest, type AiResult, type ProviderStatus, type RunInfo } from '../src/engine/aiDraft.ts';
import { buildPrompt, findOnPath, firstLines, npmBinScript, PROMPT_FILE, runProcess, writePhotos, type Launch } from './aiShared.ts';

const TIMEOUT_MS = 6 * 60_000;
const NOT_FOUND = 'Não encontrei o Gemini CLI. Instale com `npm install -g @google/gemini-cli` ou aponte o executável em GEMINI_BIN.';
const PKG = path.join('@google', 'gemini-cli');

/**
 * Como iniciar o Gemini CLI. Instalado pelo npm, ele é um script Node atrás de um shim (.cmd no Windows); rodamos
 * o script direto com o Node do próprio editor, sem passar pelo cmd.exe.
 */
export function resolveGeminiLaunch(): Launch | null {
  const custom = process.env.GEMINI_BIN;
  if (custom) {
    // Caminho que não existe conta como não instalado; nome solto (ex.: "gemini2") fica por conta do PATH.
    if (/[\\/]/.test(custom) && !existsSync(custom)) return null;
    return custom.endsWith('.js') ? { command: process.execPath, args: [custom] } : { command: custom, args: [] };
  }

  const shim = findOnPath('gemini');
  const pkgDirs = [
    // npm install -g no Windows: %APPDATA%\npm\gemini.cmd + %APPDATA%\npm\node_modules\@google\gemini-cli.
    process.env.APPDATA && path.join(process.env.APPDATA, 'npm', 'node_modules', PKG),
    // Mesmo layout em qualquer prefixo do npm que esteja no PATH (nvm, volta, prefixo próprio).
    shim && path.join(path.dirname(shim), 'node_modules', PKG),
    shim && path.join(path.dirname(shim), '..', 'lib', 'node_modules', PKG),
  ].filter((p): p is string => Boolean(p));
  for (const dir of pkgDirs) {
    const script = npmBinScript(dir, 'gemini');
    if (script) return { command: process.execPath, args: [script] };
  }
  // Fora do npm (Homebrew, binário próprio): só dá para rodar direto se não for um shim de shell do Windows.
  if (shim && !/\.(cmd|bat|ps1)$/i.test(shim)) return { command: shim, args: [] };
  return null;
}

/** Variáveis de um arquivo .env (só as linhas CHAVE=valor). */
function readEnvFile(file: string): Record<string, string> {
  if (!existsSync(file)) return {};
  const vars: Record<string, string> = {};
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (m) vars[m[1]] = m[2].trim().replace(/^(['"])(.*)\1$/, '$2');
  }
  return vars;
}

/**
 * Qual login o Gemini CLI vai usar, na mesma ordem que ele: primeiro o tipo escolhido em ~/.gemini/settings.json
 * (a chave digitada no próprio CLI fica no cofre do sistema), depois as variáveis de ambiente, ~/.gemini/.env e
 * ~/.env. Devolve uma descrição curta, ou null se não há login configurado.
 */
export function geminiAuthMethod(env: NodeJS.ProcessEnv = process.env, home = os.homedir()): string | null {
  let selected: string | undefined;
  try {
    const settings = JSON.parse(readFileSync(path.join(home, '.gemini', 'settings.json'), 'utf8')) as {
      security?: { auth?: { selectedType?: string } };
      selectedAuthType?: string;
    };
    selected = settings.security?.auth?.selectedType ?? settings.selectedAuthType;
  } catch {
    // Sem settings.json: o CLI nunca foi configurado, vale o que estiver no ambiente.
  }
  if (selected === 'gemini-api-key') return 'chave de API';
  if (selected === 'vertex-ai') return 'Vertex AI';
  if (selected === 'oauth-personal') return 'conta Google';
  if (selected) return selected;
  const vars = { ...readEnvFile(path.join(home, '.env')), ...readEnvFile(path.join(home, '.gemini', '.env')), ...env };
  if (vars.GOOGLE_GENAI_USE_VERTEXAI === 'true') return 'Vertex AI';
  if (vars.GEMINI_API_KEY) return 'chave de API';
  return null;
}

/** Traduz os erros de login e de cota do Gemini CLI para o que o usuário precisa fazer; null se não reconhece. */
export function knownGeminiError(text: string): string | null {
  if (/IneligibleTier|no longer supported for Gemini Code Assist/i.test(text)) {
    return 'O Google não aceita mais login com conta pessoal no Gemini CLI. Crie uma chave de API em https://aistudio.google.com/apikey, salve em GEMINI_API_KEY e, dentro do `gemini`, troque o login com /auth para "Use Gemini API Key" (passo a passo no COMECE-AQUI.md).';
  }
  if (/API key not valid|API_KEY_INVALID/i.test(text)) return 'A chave em GEMINI_API_KEY foi recusada pelo Google. Confira a chave em https://aistudio.google.com/apikey.';
  if (/must specify the GEMINI_API_KEY/i.test(text)) return 'O Gemini CLI está configurado para chave de API, mas GEMINI_API_KEY não está definida.';
  if (/RESOURCE_EXHAUSTED|exceeded your current quota|"code":\s*429/i.test(text)) {
    return 'O Gemini recusou por limite de uso da chave (cota). Espere um pouco ou confira o plano em https://aistudio.google.com.';
  }
  return null;
}

interface GeminiJson {
  response?: string;
  error?: { type?: string; message?: string };
}

/**
 * Último bloco JSON da saída do `--output-format json`. Na resposta normal ele é tudo o que sai no stdout; no
 * erro vai para o stderr, depois de avisos e stack traces, começando numa linha que é só "{".
 */
export function parseCliJson(text: string): GeminiJson | null {
  const starts = [...text.matchAll(/^\{\s*$/gm)].map((m) => m.index ?? 0);
  if (text.trimStart().startsWith('{')) starts.unshift(text.indexOf('{'));
  for (const i of starts.reverse()) {
    try {
      return JSON.parse(text.slice(i)) as GeminiJson;
    } catch {
      // Esse "{" não abria o bloco final; tenta o anterior.
    }
  }
  return null;
}

/** Mensagem mais interna de um erro da API, que o CLI devolve como JSON dentro de JSON dentro de texto. */
export function innermostMessage(text: string): string {
  const found = [...text.matchAll(/message\\*"\s*:\s*\\*"((?:[^"\\]|\\[^"\\])+)/g)].map((m) => m[1]);
  return found.at(-1) ?? text;
}

/** Roda `gemini -p` com o prompt no stdin e devolve o texto da resposta (ou o erro já traduzido). */
async function callGemini(launch: Launch, prompt: string, cwd: string | undefined, signal: AbortSignal | undefined, timeoutMs: number) {
  const args = ['-p', 'Siga as instruções acima.', '--output-format', 'json', '--skip-trust'];
  if (process.env.VITRINE_GEMINI_MODEL) args.push('--model', process.env.VITRINE_GEMINI_MODEL);
  const { code, stdout, stderr } = await runProcess(launch, args, { cwd, input: prompt, signal, timeoutMs, notFound: NOT_FOUND });
  const res = parseCliJson(stdout) ?? parseCliJson(stderr);
  if (code === 0 && !res?.error && typeof res?.response === 'string') return res.response;
  // Os erros conhecidos (conta recusada, chave inválida, cota) podem aparecer em qualquer parte da saída.
  const known = knownGeminiError(`${stderr}\n${stdout}`);
  if (known) throw new Error(known);
  const detail = res?.error?.message ? innermostMessage(res.error.message) : firstLines(stderr || stdout);
  throw new Error(`O Gemini CLI falhou: ${detail || `saiu com código ${code}`}`);
}

/**
 * Instalado? Logado? Sem um comando de status no Gemini CLI, a única prova de que o login funciona é uma
 * chamada de verdade (o login com conta Google, por exemplo, está configurado mas é recusado pelo servidor).
 * Por isso a checagem faz uma pergunta mínima; o resultado fica em cache no servidor.
 */
export async function geminiStatus(): Promise<ProviderStatus> {
  const launch = resolveGeminiLaunch();
  if (!launch) return { id: 'gemini', installed: false, ready: false, detail: 'Gemini CLI não instalado (npm install -g @google/gemini-cli).' };
  const method = geminiAuthMethod();
  if (!method) {
    return {
      id: 'gemini',
      installed: true,
      ready: false,
      detail: 'Gemini CLI sem login: crie uma chave em https://aistudio.google.com/apikey e salve em GEMINI_API_KEY.',
    };
  }
  try {
    await callGemini(launch, 'Responda apenas com a palavra ok.', os.tmpdir(), undefined, 90_000);
    return { id: 'gemini', installed: true, ready: true, detail: `Gemini CLI (${method})` };
  } catch (e) {
    return { id: 'gemini', installed: true, ready: false, detail: (e as Error).message };
  }
}

const validate = new Ajv({ strict: false, allErrors: true }).compile<AiResult>(AI_RESULT_SCHEMA);

/** Tira o JSON da resposta do modelo, que às vezes vem entre cercas ```json ou com uma frase antes. */
export function extractJson(text: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('a resposta não tem um objeto JSON');
  return JSON.parse(body.slice(start, end + 1));
}

/** Confere a resposta contra o mesmo JSON Schema que o Claude recebe; devolve o resultado ou a lista de erros. */
export function checkResult(text: string): { ok: true; result: AiResult } | { ok: false; errors: string } {
  let data: unknown;
  try {
    data = extractJson(text);
  } catch (e) {
    return { ok: false, errors: (e as Error).message };
  }
  if (validate(data)) return { ok: true, result: data };
  const errors = (validate.errors ?? []).slice(0, 8).map((e) => `${e.instancePath || '(raiz)'} ${e.message}`);
  return { ok: false, errors: errors.join('; ') };
}

/**
 * Roda `gemini -p` com o prompt padrão. O Gemini CLI não tem `--json-schema`: o schema vai no prompt e a
 * resposta é validada aqui; se vier fora do formato, ele recebe os erros e tem mais uma chance.
 */
export async function runGemini(req: AiRequest, signal?: AbortSignal): Promise<AiResult & RunInfo> {
  const launch = resolveGeminiLaunch();
  if (!launch) throw new Error(NOT_FOUND);
  const started = Date.now();
  const dir = await mkdtemp(path.join(os.tmpdir(), 'vitrine-'));
  try {
    const files = await writePhotos(dir, req.photos);
    const prompt = [
      buildPrompt(await readFile(PROMPT_FILE, 'utf8'), req, files, (f) => `@${f}`),
      `FORMATO DA RESPOSTA: responda SOMENTE com um objeto JSON válido que siga este JSON Schema, sem texto antes ou depois e sem cercas de código.\n${JSON.stringify(AI_RESULT_SCHEMA)}`,
    ].join('\n\n');

    let answer = await callGemini(launch, prompt, dir, signal, TIMEOUT_MS);
    let check = checkResult(answer);
    if (!check.ok) {
      const retry = `${prompt}\n\nSUA RESPOSTA ANTERIOR:\n${answer}\n\nELA NÃO SEGUE O SCHEMA (${check.errors}). Responda de novo, só com o JSON corrigido.`;
      answer = await callGemini(launch, retry, dir, signal, TIMEOUT_MS);
      check = checkResult(answer);
    }
    if (!check.ok) throw new Error(`O Gemini não devolveu o anúncio no formato esperado: ${check.errors}`);
    return { ...check.result, provider: 'gemini', durationMs: Date.now() - started, costUsd: null };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
