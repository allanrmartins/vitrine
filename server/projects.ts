import { spawn } from 'node:child_process';
import { createReadStream, existsSync } from 'node:fs';
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { slugify } from '../src/engine/format.ts';
import { mapStrings } from '../src/engine/walk.ts';
import type { Project } from '../src/types.ts';

/**
 * Projetos em disco: Anuncios/<id>/ com projeto.json, imagens/, anuncio.png e descricao.txt.
 * No projeto.json as imagens ficam como caminho relativo ("imagens/x.jpg"), então a pasta pode ser copiada ou
 * renomeada sem quebrar. Para o navegador elas viram URL "/anuncios/<id>/imagens/x.jpg".
 */
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const PROJECTS_DIR = path.join(ROOT, 'Anuncios');
export const FILES_PREFIX = '/anuncios';

const PROJECT_FILE = 'projeto.json';
const EXPORT_FILE = 'anuncio.png';
const CAPTION_FILE = 'descricao.txt';
const IMAGES_DIR = 'imagens';

const ID_RE = /^[a-z0-9][a-z0-9-]{0,79}$/;
const EXT: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };
const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function projectDir(id: string): string {
  if (!ID_RE.test(id)) throw new HttpError(400, 'Nome de projeto inválido.');
  return path.join(PROJECTS_DIR, id);
}

async function requireProject(id: string): Promise<string> {
  const dir = projectDir(id);
  if (!existsSync(dir)) throw new HttpError(404, `Projeto "${id}" não existe.`);
  return dir;
}

const urlBase = (id: string) => `${FILES_PREFIX}/${id}/`;
/** Caminho relativo à pasta -> URL. Cada trecho é codificado: fotos copiadas à mão têm espaço no nome. */
const fileUrl = (id: string, rel: string) => urlBase(id) + rel.split('/').map(encodeURIComponent).join('/');
const toRelative = (id: string, p: Project) =>
  mapStrings(p, (s) => (s.startsWith(urlBase(id)) ? s.slice(urlBase(id).length).split('/').map(decodeURIComponent).join('/') : s));
const toUrls = (id: string, p: Project) => mapStrings(p, (s) => (s.startsWith(`${IMAGES_DIR}/`) ? fileUrl(id, s) : s));

const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);

export interface FolderImage {
  name: string;
  url: string;
  size: number;
  modifiedAt: string;
}

/**
 * Imagens em Anuncios/<id>/imagens, incluindo as copiadas à mão pelo Explorer. `ignored` lista arquivos que o
 * navegador não exibe (HEIC do iPhone, RAW...), para o editor avisar em vez de sumir com eles calado.
 */
/** mtime (ms) do projeto.json, ou null se ainda não existe. Serve para o editor notar alterações feitas fora dele. */
async function projectSavedAt(id: string): Promise<number | null> {
  const file = path.join(PROJECTS_DIR, id, PROJECT_FILE);
  return existsSync(file) ? (await stat(file)).mtimeMs : null;
}

export async function listFolderImages(
  id: string,
): Promise<{ images: FolderImage[]; ignored: string[]; projectSavedAt: number | null }> {
  const dir = path.join(await requireProject(id), IMAGES_DIR);
  if (!existsSync(dir)) return { images: [], ignored: [], projectSavedAt: await projectSavedAt(id) };
  const entries = (await readdir(dir, { withFileTypes: true })).filter((e) => e.isFile() && !e.name.startsWith('.'));
  const images: FolderImage[] = [];
  const ignored: string[] = [];
  for (const e of entries) {
    if (!IMAGE_EXT.has(path.extname(e.name).toLowerCase())) {
      if (!/^(desktop\.ini|thumbs\.db)$/i.test(e.name)) ignored.push(e.name);
      continue;
    }
    const st = await stat(path.join(dir, e.name));
    images.push({ name: e.name, url: fileUrl(id, `${IMAGES_DIR}/${e.name}`), size: st.size, modifiedAt: st.mtime.toISOString() });
  }
  images.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true }));
  return { images, ignored, projectSavedAt: await projectSavedAt(id) };
}

function decodeDataUrl(dataUrl: string): { buffer: Buffer; ext: string } {
  const m = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl);
  if (!m || !EXT[m[1]]) throw new HttpError(400, 'Imagem em formato não suportado.');
  return { buffer: Buffer.from(m[2], 'base64'), ext: EXT[m[1]] };
}

export interface ProjectSummary {
  id: string;
  title: string;
  updatedAt: string;
  /** Quando o anuncio.png foi gerado pela última vez (null se nunca). */
  exportedAt: string | null;
  thumb: string | null;
}

/** Data e URL (com cache-buster) do anuncio.png do projeto, se existir. */
async function exportInfo(id: string): Promise<{ exportedAt: string; url: string } | null> {
  const file = path.join(PROJECTS_DIR, id, EXPORT_FILE);
  if (!existsSync(file)) return null;
  const { mtime } = await stat(file);
  return { exportedAt: mtime.toISOString(), url: `${urlBase(id)}${EXPORT_FILE}?v=${mtime.getTime()}` };
}

export async function listProjects(): Promise<ProjectSummary[]> {
  await mkdir(PROJECTS_DIR, { recursive: true });
  const entries = await readdir(PROJECTS_DIR, { withFileTypes: true });
  const list = await Promise.all(
    entries
      .filter((e) => e.isDirectory() && ID_RE.test(e.name))
      .map(async (e): Promise<ProjectSummary> => {
        const dir = path.join(PROJECTS_DIR, e.name);
        const file = path.join(dir, PROJECT_FILE);
        let title = e.name;
        let thumb: string | null = null;
        let updated = (await stat(dir)).mtime;
        if (existsSync(file)) {
          updated = (await stat(file)).mtime;
          try {
            const p = toUrls(e.name, JSON.parse(await readFile(file, 'utf8')) as Project);
            title = p.data.title || p.data.subtitle || e.name;
            thumb = p.data.images.main;
          } catch {
            // projeto.json corrompido: ainda lista a pasta para o usuário poder abrir e salvar de novo.
          }
        }
        const exp = await exportInfo(e.name);
        if (!exp && !thumb) thumb = (await listFolderImages(e.name)).images[0]?.url ?? null;
        return { id: e.name, title, updatedAt: updated.toISOString(), exportedAt: exp?.exportedAt ?? null, thumb: exp?.url ?? thumb };
      }),
  );
  return list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** Cria a pasta do projeto; se o nome já existir, acrescenta -2, -3... */
export async function createProject(name: string): Promise<string> {
  await mkdir(PROJECTS_DIR, { recursive: true });
  const base = slugify(name) || `anuncio-${new Date().toISOString().slice(0, 10)}`;
  let id = base;
  for (let n = 2; existsSync(path.join(PROJECTS_DIR, id)); n++) id = `${base}-${n}`;
  await mkdir(path.join(PROJECTS_DIR, id, IMAGES_DIR), { recursive: true });
  return id;
}

export async function loadProject(
  id: string,
): Promise<{ project: Project | null; exportedAt: string | null; savedAt: number | null }> {
  const file = path.join(await requireProject(id), PROJECT_FILE);
  const exportedAt = (await exportInfo(id))?.exportedAt ?? null;
  if (!existsSync(file)) return { project: null, exportedAt, savedAt: null };
  return { project: toUrls(id, JSON.parse(await readFile(file, 'utf8')) as Project), exportedAt, savedAt: await projectSavedAt(id) };
}

export async function saveProject(id: string, project: Project, description: string): Promise<number | null> {
  const dir = await requireProject(id);
  await writeFile(path.join(dir, PROJECT_FILE), JSON.stringify(toRelative(id, project), null, 2));
  await writeFile(path.join(dir, CAPTION_FILE), description);
  return projectSavedAt(id);
}

export async function saveImage(id: string, dataUrl: string, hint: string): Promise<string> {
  const dir = path.join(await requireProject(id), IMAGES_DIR);
  await mkdir(dir, { recursive: true });
  const { buffer, ext } = decodeDataUrl(dataUrl);
  const name = `${slugify(hint).slice(0, 24) || 'imagem'}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}.${ext}`;
  await writeFile(path.join(dir, name), buffer);
  return fileUrl(id, `${IMAGES_DIR}/${name}`);
}

export async function saveExport(id: string, pngDataUrl: string, description: string): Promise<{ path: string; exportedAt: string }> {
  const dir = await requireProject(id);
  const { buffer } = decodeDataUrl(pngDataUrl);
  await writeFile(path.join(dir, EXPORT_FILE), buffer);
  await writeFile(path.join(dir, CAPTION_FILE), description);
  return { path: path.join(dir, EXPORT_FILE), exportedAt: (await stat(path.join(dir, EXPORT_FILE))).mtime.toISOString() };
}

/** Abre a pasta do projeto no gerenciador de arquivos do sistema (com o anuncio.png selecionado, se houver). */
export async function revealProject(id: string): Promise<void> {
  const dir = await requireProject(id);
  const png = path.join(dir, EXPORT_FILE);
  const [cmd, args] =
    process.platform === 'win32'
      ? ['explorer.exe', existsSync(png) ? [`/select,${png}`] : [dir]]
      : process.platform === 'darwin'
        ? ['open', existsSync(png) ? ['-R', png] : [dir]]
        : ['xdg-open', [dir]];
  spawn(cmd, args, { detached: true, stdio: 'ignore' }).unref();
}

/** Serve /anuncios/<id>/<arquivo>, sem sair da pasta Anuncios. */
export function serveProjectFile(req: IncomingMessage, res: ServerResponse, next: () => void) {
  const rel = decodeURIComponent((req.url ?? '').split('?')[0]).replace(/^\/+/, '');
  const file = path.resolve(PROJECTS_DIR, rel);
  if (!file.startsWith(PROJECTS_DIR + path.sep) || !existsSync(file)) return next();
  res.setHeader('Content-Type', MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream');
  res.setHeader('Cache-Control', 'no-cache');
  createReadStream(file).pipe(res);
}
