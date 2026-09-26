import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AI_RESULT_SCHEMA, type AiRequest, type AiResult } from '../src/engine/aiDraft.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROMPT_FILE = path.join(ROOT, 'prompts', 'anuncio.md');
const TIMEOUT_MS = 6 * 60_000;

/**
 * Caminho do executável do Claude Code. No Windows o `claude` global é um shim .cmd, que o Node só roda via
 * shell (e aí o JSON do schema quebra no quoting do cmd.exe); por isso vamos direto no claude.exe.
 */
export function resolveClaudeBin(): string {
  if (process.env.CLAUDE_BIN) return process.env.CLAUDE_BIN;
  if (process.platform === 'win32') {
    const candidates = [
      // Instalador nativo (irm https://claude.ai/install.ps1 | iex).
      process.env.USERPROFILE && path.join(process.env.USERPROFILE, '.local', 'bin', 'claude.exe'),
      // npm install -g @anthropic-ai/claude-code.
      process.env.APPDATA && path.join(process.env.APPDATA, 'npm', 'node_modules', '@anthropic-ai', 'claude-code', 'bin', 'claude.exe'),
    ].filter((p): p is string => Boolean(p));
    const found = candidates.find((p) => existsSync(p));
    if (found) return found;
  }
  // No PATH (macOS/Linux, ou claude.exe no PATH do Windows).
  return 'claude';
}

const EXT: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };

async function writePhotos(dir: string, photos: string[]): Promise<string[]> {
  return Promise.all(
    photos.map(async (dataUrl, i) => {
      const m = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl);
      if (!m) throw new Error(`Foto ${i + 1} não está em data URL.`);
      const name = `foto-${i + 1}.${EXT[m[1]] ?? 'png'}`;
      await writeFile(path.join(dir, name), Buffer.from(m[2], 'base64'));
      return name;
    }),
  );
}

function buildPrompt(guide: string, req: AiRequest, files: string[]): string {
  const task =
    req.mode === 'generate'
      ? 'TAREFA: montar o anúncio do zero a partir das fotos e das anotações do vendedor. O rascunho atual serve só como ponto de partida (cor, entrega e CTA que o vendedor já escolheu).'
      : 'TAREFA: aplicar no rascunho atual SOMENTE o ajuste pedido pelo vendedor. Mantenha todo o resto idêntico, inclusive a escolha de fotos.';
  const photoList = files.length ? files.map((f, i) => `- foto-${i + 1}: ./${f}`).join('\n') : '(nenhuma foto)';
  return [
    guide,
    '---',
    task,
    `FOTOS (numeradas; use os números em mainPhoto, secondaryPhotos, photo e "photo:N"):\n${photoList}`,
    `RASCUNHO ATUAL:\n\`\`\`json\n${JSON.stringify(req.draft, null, 2)}\n\`\`\``,
    `${req.mode === 'generate' ? 'ANOTAÇÕES DO VENDEDOR' : 'AJUSTE PEDIDO'}:\n${req.instruction.trim() || '(nenhuma)'}`,
  ].join('\n\n');
}

export interface RunInfo {
  durationMs: number;
  costUsd: number | null;
}

/** Roda `claude -p` com o prompt padrão e devolve o rascunho validado pelo JSON Schema. */
export async function runClaude(req: AiRequest, signal?: AbortSignal): Promise<AiResult & RunInfo> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'vitrine-'));
  try {
    const files = await writePhotos(dir, req.photos);
    const prompt = buildPrompt(await readFile(PROMPT_FILE, 'utf8'), req, files);
    const args = [
      '-p',
      '--output-format', 'json',
      '--json-schema', JSON.stringify(AI_RESULT_SCHEMA),
      '--tools', 'Read',
      '--allowedTools', 'Read',
      '--no-session-persistence',
    ];
    if (process.env.VITRINE_MODEL) args.push('--model', process.env.VITRINE_MODEL);

    const stdout = await new Promise<string>((resolve, reject) => {
      const child = spawn(resolveClaudeBin(), args, { cwd: dir, stdio: ['pipe', 'pipe', 'pipe'], signal, windowsHide: true });
      let out = '';
      let err = '';
      const timer = setTimeout(() => child.kill(), TIMEOUT_MS);
      child.stdout.on('data', (d) => (out += d));
      child.stderr.on('data', (d) => (err += d));
      child.on('error', (e) => {
        clearTimeout(timer);
        reject(new Error(`Não consegui executar o Claude Code (${e.message}). Ele está instalado e logado?`));
      });
      child.on('close', (code) => {
        clearTimeout(timer);
        if (code === 0) resolve(out);
        else reject(new Error(`claude -p saiu com código ${code}: ${(err || out).trim().slice(0, 600)}`));
      });
      child.stdin.end(prompt);
    });

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
    return { ...res.structured_output, durationMs: res.duration_ms ?? 0, costUsd: res.total_cost_usd ?? null };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
