import type { Project } from '../types.ts';

/** Cliente da API local de projetos (server/projects.ts). Só existe rodando `npm run dev` nesta máquina. */

export interface ProjectSummary {
  id: string;
  title: string;
  updatedAt: string;
  exportedAt: string | null;
  thumb: string | null;
}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
  });
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(json.error ?? `Erro ${res.status} em ${url}`);
  return json;
}

export async function projectsAvailable(): Promise<boolean> {
  try {
    const res = await fetch('/api/projetos');
    return res.ok && Array.isArray(await res.json());
  } catch {
    return false;
  }
}

export const listProjects = () => call<ProjectSummary[]>('/api/projetos');

export const createProject = async (name: string) =>
  (await call<{ id: string }>('/api/projetos', { method: 'POST', body: JSON.stringify({ name }) })).id;

export const fetchProject = (id: string) =>
  call<{ project: Project | null; exportedAt: string | null; savedAt: number | null }>(`/api/projetos/${encodeURIComponent(id)}`);

/** Devolve o mtime do projeto.json gravado (para detectar alterações feitas fora do editor). */
export const putProject = async (id: string, project: Project, description: string) =>
  (
    await call<{ savedAt: number | null }>(`/api/projetos/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify({ project, description }),
    })
  ).savedAt;

export const uploadImage = async (id: string, dataUrl: string, hint: string) =>
  (
    await call<{ url: string }>(`/api/projetos/${encodeURIComponent(id)}/imagens`, {
      method: 'POST',
      body: JSON.stringify({ dataUrl, hint }),
    })
  ).url;

export const saveExport = (id: string, png: string, description: string) =>
  call<{ path: string; exportedAt: string }>(`/api/projetos/${encodeURIComponent(id)}/exportar`, {
    method: 'POST',
    body: JSON.stringify({ png, description }),
  });

export interface FolderImage {
  name: string;
  url: string;
  size: number;
  modifiedAt: string;
}

/** Imagens da pasta imagens/ do projeto, inclusive as copiadas à mão pelo Explorer. */
export const fetchFolderImages = (id: string) =>
  call<{ images: FolderImage[]; ignored: string[]; projectSavedAt: number | null }>(
    `/api/projetos/${encodeURIComponent(id)}/imagens`,
  );

export const revealProject = (id: string) => call(`/api/projetos/${encodeURIComponent(id)}/revelar`, { method: 'POST' });

/**
 * Gravação de emergência ao fechar/recarregar a página: `keepalive` deixa a requisição terminar depois que a
 * aba some. O limite do keepalive é 64 KB; o projeto tem só textos e caminhos de imagem, então cabe folgado.
 */
export function putProjectOnUnload(id: string, project: Project, description: string) {
  const body = JSON.stringify({ project, description });
  if (body.length > 60_000) return;
  fetch(`/api/projetos/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => undefined);
}

/** URL de arquivo que já mora na pasta do projeto `id`. */
export const isProjectFile = (id: string, src: string) => src.startsWith(`/anuncios/${id}/`);

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}
