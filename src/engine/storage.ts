import { get, set } from 'idb-keyval';
import type { Project } from '../types.ts';

const KEY = 'vitrine:current';

/** Rascunho do navegador: o anúncio aberto e a pasta dele em Anuncios/ (null se ainda não tem pasta). */
export interface Draft {
  project: Project;
  folder: string | null;
}

export async function loadDraft(): Promise<Draft | null> {
  try {
    const d = await get<Draft | Project>(KEY);
    if (!d) return null;
    // Formato antigo: só o Project, sem pasta.
    if ('version' in d) return d.version === 1 ? { project: d, folder: null } : null;
    return d.project?.version === 1 ? d : null;
  } catch {
    return null;
  }
}

export async function saveDraft(draft: Draft): Promise<void> {
  try {
    await set(KEY, draft);
  } catch {
    // Navegação privada ou armazenamento bloqueado: o editor segue funcionando sem rascunho.
  }
}

export function parseProject(text: string): Project {
  const p = JSON.parse(text) as Project;
  if (p?.version !== 1 || typeof p.data !== 'object') throw new Error('Arquivo de projeto inválido.');
  return p;
}
