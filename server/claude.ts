import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { AI_RESULT_SCHEMA, type AiRequest, type AiResult, type ProviderStatus, type RunInfo } from '../src/engine/aiDraft.ts';
import { buildPrompt, findOnPath, firstLines, PROMPT_FILE, runProcess, writePhotos, type Launch } from './aiShared.ts';

const TIMEOUT_MS = 6 * 60_000;
const NOT_FOUND = 'Não encontrei o Claude Code. Instale-o (https://claude.com/claude-code) ou aponte o executável em CLAUDE_BIN.';

/**
 * Executável do Claude Code. No Windows o `claude` global é um shim .cmd, que o Node só roda via shell (e aí o
 * JSON do schema quebra no quoting do cmd.exe); por isso vamos direto no claude.exe.
 */
export function resolveClaudeBin(): string | null {
  const custom = process.env.CLAUDE_BIN;
  if (custom) return /[\\/]/.test(custom) && !existsSync(custom) ? null : custom;
  if (process.platform === 'win32') {
    const candidates = [
      // Instalador nativo (irm https://claude.ai/install.ps1 | iex).
      process.env.USERPROFILE && path.join(process.env.USERPROFILE, '.local', 'bin', 'claude.exe'),
      // npm install -g @anthropic-ai/claude-code.
      process.env.APPDATA && path.join(process.env.APPDATA, 'npm', 'node_modules', '@anthropic-ai', 'claude-code', 'bin', 'claude.exe'),
    ].filter((p): p is string => Boolean(p));
    return candidates.find((p) => existsSync(p)) ?? findOnPath('claude', ['.exe']);
  }
  return findOnPath('claude');
}

/** Instalado? Logado? Usa `claude auth status`, que responde na hora e sem gastar nada. */
export async function claudeStatus(): Promise<ProviderStatus> {
  const bin = resolveClaudeBin();
  if (!bin) return { id: 'claude', installed: false, ready: false, detail: 'Claude Code não instalado (https://claude.com/claude-code).' };
  const launch: Launch = { command: bin, args: [] };
  try {
    const res = await runProcess(launch, ['auth', 'status'], { timeoutMs: 20_000, notFound: NOT_FOUND });
    let auth: { loggedIn?: boolean; authMethod?: string } | null = null;
    try {
      auth = JSON.parse(res.stdout);
    } catch {
      // Versão antiga sem `auth status`: se o comando rodou, confiamos que está logado.
    }
    if (auth?.loggedIn === false) {
      return { id: 'claude', installed: true, ready: false, detail: 'Claude Code sem login: rode `claude` no terminal e entre na sua conta.' };
    }
    if (!auth && res.code !== 0) {
      return { id: 'claude', installed: true, ready: false, detail: `O Claude Code não respondeu: ${firstLines(res.stderr || res.stdout)}` };
    }
    const how = auth?.authMethod === 'claude.ai' ? 'assinatura Claude' : auth?.authMethod ? 'chave de API' : 'instalado';
    return { id: 'claude', installed: true, ready: true, detail: `Claude Code (${how})` };
  } catch (e) {
    return { id: 'claude', installed: false, ready: false, detail: (e as Error).message };
  }
}

/** Roda `claude -p` com o prompt padrão e devolve o rascunho validado pelo JSON Schema (`--json-schema`). */
export async function runClaude(req: AiRequest, signal?: AbortSignal): Promise<AiResult & RunInfo> {
  const bin = resolveClaudeBin();
  if (!bin) throw new Error(NOT_FOUND);
  const dir = await mkdtemp(path.join(os.tmpdir(), 'vitrine-'));
  try {
    const files = await writePhotos(dir, req.photos);
    const prompt = buildPrompt(await readFile(PROMPT_FILE, 'utf8'), req, files, (f) => `./${f}`);
    const args = [
      '-p',
      '--output-format', 'json',
      '--json-schema', JSON.stringify(AI_RESULT_SCHEMA),
      '--tools', 'Read',
      '--allowedTools', 'Read',
      '--no-session-persistence',
    ];
    if (process.env.VITRINE_MODEL) args.push('--model', process.env.VITRINE_MODEL);

    const { code, stdout, stderr } = await runProcess({ command: bin, args: [] }, args, {
      cwd: dir,
      input: prompt,
      signal,
      timeoutMs: TIMEOUT_MS,
      notFound: NOT_FOUND,
    });
    if (code !== 0) throw new Error(`claude -p saiu com código ${code}: ${(stderr || stdout).trim().slice(0, 600)}`);

    const res = JSON.parse(stdout) as {
      is_error?: boolean;
      result?: string;
      structured_output?: AiResult;
      duration_ms?: number;
      total_cost_usd?: number;
    };
    if (res.is_error || !res.structured_output) {
      throw new Error(`O Claude não devolveu o anúncio estruturado: ${String(res.result ?? '').slice(0, 600)}`);
    }
    return { ...res.structured_output, provider: 'claude', durationMs: res.duration_ms ?? 0, costUsd: res.total_cost_usd ?? null };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
