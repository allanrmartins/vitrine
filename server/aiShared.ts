/** Peças comuns às CLIs de IA (Claude Code e Gemini CLI): fotos, prompt, execução e busca do executável. */
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AiRequest } from '../src/engine/aiDraft.ts';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const PROMPT_FILE = path.join(ROOT, 'prompts', 'anuncio.md');

/** Como iniciar uma CLI: `node gemini.js` no Windows evita o shim .cmd (e o quoting do cmd.exe). */
export interface Launch {
  command: string;
  args: string[];
}

const EXT: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };

/** Grava as fotos (data URLs) em `dir` como foto-1.jpg, foto-2.png... e devolve os nomes. */
export async function writePhotos(dir: string, photos: string[]): Promise<string[]> {
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

/**
 * Prompt completo: regras de `prompts/anuncio.md` + tarefa + fotos + rascunho. `photoRef` diz como cada CLI
 * enxerga um arquivo (o Claude abre com a ferramenta Read; o Gemini recebe o conteúdo com `@arquivo`).
 */
export function buildPrompt(guide: string, req: AiRequest, files: string[], photoRef: (file: string) => string): string {
  const task =
    req.mode === 'generate'
      ? 'TAREFA: montar o anúncio do zero a partir das fotos e das anotações do vendedor. O rascunho atual serve só como ponto de partida (cor, entrega e CTA que o vendedor já escolheu).'
      : 'TAREFA: aplicar no rascunho atual SOMENTE o ajuste pedido pelo vendedor. Mantenha todo o resto idêntico, inclusive a escolha de fotos.';
  const photoList = files.length ? files.map((f, i) => `- foto-${i + 1}: ${photoRef(f)}`).join('\n') : '(nenhuma foto)';
  return [
    guide,
    '---',
    task,
    `FOTOS (numeradas; use os números em mainPhoto, secondaryPhotos, photo e "photo:N"):\n${photoList}`,
    `RASCUNHO ATUAL:\n\`\`\`json\n${JSON.stringify(req.draft, null, 2)}\n\`\`\``,
    `${req.mode === 'generate' ? 'ANOTAÇÕES DO VENDEDOR' : 'AJUSTE PEDIDO'}:\n${req.instruction.trim() || '(nenhuma)'}`,
  ].join('\n\n');
}

export interface ProcessResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

/** Roda uma CLI com `input` no stdin. Não rejeita por código de saída: quem chama decide o que é erro. */
export function runProcess(
  launch: Launch,
  args: string[],
  opts: { cwd?: string; input?: string; signal?: AbortSignal; timeoutMs: number; notFound: string },
): Promise<ProcessResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(launch.command, [...launch.args, ...args], {
      cwd: opts.cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      signal: opts.signal,
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, opts.timeoutMs);
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    child.on('error', (e) => {
      clearTimeout(timer);
      reject((e as NodeJS.ErrnoException).code === 'ENOENT' ? new Error(opts.notFound) : e);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (timedOut) reject(new Error(`A IA não respondeu em ${Math.round(opts.timeoutMs / 1000)}s.`));
      else resolve({ code, stdout, stderr });
    });
    child.stdin.on('error', () => {}); // a CLI pode fechar o stdin antes de ler tudo (ex.: --version)
    child.stdin.end(opts.input ?? '');
  });
}

/** Procura um executável no PATH. No Windows, testa as extensões do PATHEXT (ou só `exts`, se passadas). */
export function findOnPath(name: string, exts?: string[]): string | null {
  const dirs = (process.env.PATH ?? '').split(path.delimiter).filter(Boolean);
  const suffixes =
    process.platform === 'win32' ? (exts ?? (process.env.PATHEXT ?? '.EXE;.CMD;.BAT').split(';').map((e) => e.toLowerCase())) : [''];
  for (const dir of dirs) {
    for (const ext of suffixes) {
      const full = path.join(dir, name + ext);
      if (existsSync(full)) return full;
    }
  }
  return null;
}

/** Script de entrada (campo `bin`) de um pacote npm instalado em `pkgDir`, para rodar com o próprio Node. */
export function npmBinScript(pkgDir: string, binName: string): string | null {
  try {
    const pkg = JSON.parse(readFileSync(path.join(pkgDir, 'package.json'), 'utf8')) as { bin?: string | Record<string, string> };
    const rel = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin?.[binName];
    const full = rel && path.join(pkgDir, rel);
    return full && existsSync(full) ? full : null;
  } catch {
    return null;
  }
}

/** Primeira linha útil de uma saída de erro, curta o bastante para caber no painel. */
export function firstLines(text: string, max = 400): string {
  return text.trim().split(/\r?\n/).filter(Boolean).slice(0, 4).join(' ').slice(0, max);
}
