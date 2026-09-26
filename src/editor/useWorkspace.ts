import { useCallback, useEffect, useRef, useState } from 'react';
import { useImmer } from 'use-immer';
import type { AdData, Project } from '../types.ts';
import { demoAd, emptyAd } from '../defaults.ts';
import { buildDescription } from '../engine/description.ts';
import { urlToBlob } from '../engine/image.ts';
import {
  blobToDataUrl,
  createProject,
  fetchFolderImages,
  fetchProject,
  isProjectFile,
  listProjects,
  projectsAvailable,
  putProject,
  putProjectOnUnload,
  revealProject,
  saveExport,
  uploadImage,
  type FolderImage,
  type ProjectSummary,
} from '../engine/projects.ts';
import { loadDraft, parseProject, saveDraft } from '../engine/storage.ts';
import { collectStrings, mapStrings } from '../engine/walk.ts';

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const AUTOSAVE_MS = 500;
/** Intervalo para notar fotos copiadas à mão na pasta enquanto o editor está visível. */
const FOLDER_POLL_MS = 4000;
const newProject = (data: AdData): Project => ({ version: 1, data, descriptionOverride: null });
const descriptionOf = (p: Project) => p.descriptionOverride ?? buildDescription(p.data);

/**
 * Estado do anúncio aberto, sua pasta em Anuncios/ e a lista de projetos do explorador.
 * - Com a API local: cada anúncio tem uma pasta, criada no "Novo" ou na primeira imagem/geração; tudo é salvo
 *   nela automaticamente (projeto.json, imagens/, descricao.txt, anuncio.png ao gerar a imagem).
 * - Trocar de projeto grava o atual na hora (sem esperar o salvamento automático); fechar a aba também.
 * - Sem a API (editor hospedado): rascunho só no navegador, imagens como data URL.
 * O IndexedDB guarda o rascunho e qual pasta estava aberta, para reabrir onde parou.
 */
export function useWorkspace(notify: (msg: string) => void) {
  const [project, setProject] = useImmer<Project>(() => newProject(demoAd()));
  const [folder, setFolderState] = useState<string | null>(null);
  const [online, setOnline] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [exportedAt, setExportedAt] = useState<string | null>(null);
  const [switching, setSwitching] = useState<string | null>(null);
  /** Muda a cada troca de projeto (abrir, novo, exemplo, importar); a criação automática de pasta não conta. */
  const [session, setSession] = useState(0);
  const [folderImages, setFolderImages] = useState<{ images: FolderImage[]; ignored: string[] }>({ images: [], ignored: [] });

  const projectRef = useRef(project);
  projectRef.current = project;
  const folderRef = useRef<string | null>(null);
  const pendingFolder = useRef<Promise<string> | null>(null);
  /** Última versão gravada no disco (JSON), por pasta: evita regravar o que acabou de ser aberto. */
  const savedSnapshot = useRef<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const saving = useRef<Promise<void>>(Promise.resolve());
  /** mtime do projeto.json na última leitura/gravação desta aba; outro valor no disco = alterado por fora. */
  const savedAt = useRef<number | null>(null);
  const savesInFlight = useRef(0);
  const warnedConflict = useRef(false);

  const description = descriptionOf(project);

  const refreshList = useCallback(async () => {
    try {
      setProjects(await listProjects());
    } catch {
      // Lista é auxiliar; o erro real aparece quando o usuário tenta abrir/salvar.
    }
  }, []);

  /** Troca o projeto aberto de uma vez (estado, pasta e snapshot), sem disparar gravação. */
  const show = useCallback(
    (p: Project, id: string | null, exported: string | null = null, diskSavedAt: number | null = null, newSession = true) => {
      clearTimeout(saveTimer.current);
      savedAt.current = diskSavedAt;
      folderRef.current = id;
      pendingFolder.current = null;
      projectRef.current = p;
      savedSnapshot.current = id ? JSON.stringify(p) : null;
      setProject(() => p);
      setFolderState(id);
      setExportedAt(exported);
      setSaveState(id ? 'saved' : 'idle');
      if (newSession) setSession((n) => n + 1);
    },
    [setProject],
  );

  /** Grava o projeto aberto agora, se mudou desde a última gravação. Encadeado para nunca gravar fora de ordem. */
  const flush = useCallback((force = false): Promise<void> => {
    clearTimeout(saveTimer.current);
    const id = folderRef.current;
    const p = projectRef.current;
    const json = JSON.stringify(p);
    if (!id || (!force && json === savedSnapshot.current)) return saving.current;
    saving.current = saving.current.then(async () => {
      setSaveState('saving');
      savesInFlight.current++;
      try {
        const diskSavedAt = await putProject(id, p, descriptionOf(p));
        if (folderRef.current === id) {
          savedSnapshot.current = json;
          savedAt.current = diskSavedAt;
          warnedConflict.current = false;
          setSaveState('saved');
        }
        // Título na lista acompanha a edição.
        setProjects((list) =>
          list?.map((it) => (it.id === id ? { ...it, title: p.data.title || p.data.subtitle || id, updatedAt: new Date().toISOString() } : it)) ?? list,
        );
      } catch (e) {
        setSaveState('error');
        notify(e instanceof Error ? e.message : 'Falha ao salvar o projeto.');
        throw e;
      } finally {
        savesInFlight.current--;
      }
    });
    return saving.current;
  }, [notify]);

  // Abertura: reabre a pasta do último uso (o disco vence o rascunho do navegador).
  useEffect(() => {
    (async () => {
      const [api, draft] = await Promise.all([projectsAvailable(), loadDraft()]);
      setOnline(api);
      if (api) refreshList();
      if (draft) {
        show(draft.project, null);
        if (api && draft.folder) {
          try {
            const disk = await fetchProject(draft.folder);
            show(disk.project ?? draft.project, draft.folder, disk.exportedAt, disk.savedAt);
          } catch {
            // Pasta apagada ou renomeada fora do editor: segue com o rascunho, sem pasta.
          }
        }
      }
      setLoaded(true);
    })();
  }, [show, refreshList]);

  // Salvamento automático (e rascunho no navegador).
  useEffect(() => {
    if (!loaded) return;
    saveDraft({ project, folder });
    if (!online || !folder) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => flush().catch(() => undefined), AUTOSAVE_MS);
  }, [project, folder, loaded, online, flush]);

  // Fechar ou recarregar a aba no meio da digitação não perde a última alteração.
  useEffect(() => {
    const onHide = () => {
      const id = folderRef.current;
      const p = projectRef.current;
      if (id && JSON.stringify(p) !== savedSnapshot.current) putProjectOnUnload(id, p, descriptionOf(p));
    };
    window.addEventListener('pagehide', onHide);
    return () => window.removeEventListener('pagehide', onHide);
  }, []);

  /** Copia para a pasta `id` toda imagem que ainda está fora dela (data URL, exemplo, outra pasta). */
  const internalize = useCallback(
    async (id: string) => {
      const foreign = collectStrings(
        projectRef.current,
        (s) => s.startsWith('data:image/') || s.startsWith('/demo/') || (s.startsWith('/anuncios/') && !isProjectFile(id, s)),
      );
      if (!foreign.size) return;
      const moved = new Map<string, string>();
      for (const src of foreign) {
        const dataUrl = src.startsWith('data:') ? src : await blobToDataUrl(await urlToBlob(src));
        const hint = src.split('/').pop()?.replace(/\.[a-z]+$/i, '').replace(/-[a-z0-9]{8,}$/, '') ?? 'imagem';
        moved.set(src, await uploadImage(id, dataUrl, src.startsWith('data:') ? 'imagem' : hint));
      }
      setProject((p) => mapStrings(p, (s) => moved.get(s) ?? s));
    },
    [setProject],
  );

  /** Pasta do anúncio atual; cria na primeira necessidade (nome = título, ou data). */
  const ensureFolder = useCallback(async (): Promise<string> => {
    if (folderRef.current) return folderRef.current;
    pendingFolder.current ??= (async () => {
      const d = projectRef.current.data;
      const id = await createProject(d.title || d.subtitle);
      folderRef.current = id;
      setFolderState(id);
      await internalize(id);
      notify(`Pasta criada: Anuncios/${id}`);
      refreshList();
      return id;
    })();
    try {
      return await pendingFolder.current;
    } catch (e) {
      pendingFolder.current = null;
      throw e;
    }
  }, [internalize, notify, refreshList]);

  const refreshFolderImages = useCallback(async () => {
    const id = folderRef.current;
    if (!online || !id) return setFolderImages({ images: [], ignored: [] });
    try {
      const { projectSavedAt, ...next } = await fetchFolderImages(id);
      if (folderRef.current !== id) return;
      // Só troca o estado se mudou algo: o polling não deve re-renderizar o editor à toa.
      setFolderImages((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));

      // projeto.json alterado fora desta aba (outra aba, edição à mão, script): recarrega se não houver edição
      // pendente aqui; se houver, mantém a daqui (ela será gravada por cima) e avisa uma vez.
      const external = projectSavedAt !== null && savedAt.current !== null && Math.abs(projectSavedAt - savedAt.current) > 1;
      if (!external || savesInFlight.current > 0) return;
      if (JSON.stringify(projectRef.current) !== savedSnapshot.current) {
        if (!warnedConflict.current) {
          warnedConflict.current = true;
          notify('O projeto foi alterado fora do editor, mas há edições suas pendentes: mantive as suas.');
        }
        return;
      }
      const disk = await fetchProject(id);
      if (folderRef.current !== id || !disk.project || JSON.stringify(projectRef.current) !== savedSnapshot.current) return;
      show(disk.project, id, disk.exportedAt, disk.savedAt, false);
      notify('Projeto recarregado: foi alterado fora do editor');
    } catch {
      // Pasta sumiu no meio do caminho; a próxima ação de salvar mostra o erro.
    }
  }, [online, show, notify]);

  // Fotos da pasta: ao trocar de projeto, ao voltar para a janela (depois de copiar arquivos no Explorer) e,
  // enquanto a aba está visível, a cada poucos segundos.
  useEffect(() => {
    refreshFolderImages();
    const onFocus = () => document.visibilityState === 'visible' && refreshFolderImages();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    const t = setInterval(() => document.visibilityState === 'visible' && refreshFolderImages(), FOLDER_POLL_MS);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
      clearInterval(t);
    };
  }, [folder, refreshFolderImages]);

  const storeImage = useCallback(
    async (dataUrl: string, hint: string) => {
      if (!online) return dataUrl;
      try {
        const url = await uploadImage(await ensureFolder(), dataUrl, hint);
        refreshFolderImages();
        return url;
      } catch (e) {
        notify(`Imagem não foi salva na pasta: ${e instanceof Error ? e.message : e}`);
        return dataUrl;
      }
    },
    [online, ensureFolder, notify, refreshFolderImages],
  );

  /** Grava o atual e só então troca; se a gravação falhar, fica onde está (nada se perde). */
  const leaveCurrent = async (): Promise<boolean> => {
    try {
      await flush();
      return true;
    } catch {
      notify('Não consegui salvar o anúncio atual; continuei nele para não perder nada.');
      return false;
    }
  };

  const actions = {
    open: async (id: string) => {
      if (id === folderRef.current || switching) return;
      setSwitching(id);
      try {
        if (!(await leaveCurrent())) return;
        const disk = await fetchProject(id);
        show(disk.project ?? newProject(emptyAd()), id, disk.exportedAt, disk.savedAt);
        // Pasta sem projeto.json (criada à mão no Explorer, ou por versão antiga): grava um em branco.
        if (!disk.project) await flush(true).catch(() => undefined);
      } catch (e) {
        notify(e instanceof Error ? e.message : `Não consegui abrir ${id}.`);
      } finally {
        setSwitching(null);
      }
    },
    /** Novo anúncio já com pasta própria (quando a API local está disponível). */
    create: async (name: string) => {
      if (!(await leaveCurrent())) return;
      const id = online ? await createProject(name) : null;
      show(newProject(emptyAd()), id);
      if (id) {
        // Grava o projeto.json já na criação (vazio): a pasta nasce completa, mesmo que você só copie fotos nela.
        await flush(true).catch(() => undefined);
        refreshList();
        notify(`Novo anúncio em Anuncios/${id}`);
      }
    },
    loadDemo: async () => {
      if (!(await leaveCurrent())) return;
      show(newProject(demoAd()), null);
      notify('Exemplo carregado (a pasta é criada ao adicionar uma imagem)');
    },
    importFile: async (file: File) => {
      const p = parseProject(await file.text());
      if (!(await leaveCurrent())) return;
      show(p, null);
      if (online) await ensureFolder();
      else notify('Projeto importado');
    },
    replaceData: (next: AdData, label?: string) => {
      setProject((p) => {
        p.data = next;
        p.descriptionOverride = null;
      });
      if (label) notify(label);
    },
    /**
     * Grava anuncio.png e descricao.txt na pasta; devolve o caminho no disco, ou null sem API local.
     * `target` é a pasta capturada quando a geração começou: se o usuário trocar de projeto no meio da
     * renderização, o PNG ainda vai para o projeto certo.
     */
    saveExport: async (png: Blob, target: { folder: string | null; description: string }): Promise<string | null> => {
      if (!online) return null;
      const id = target.folder ?? (await ensureFolder());
      const res = await saveExport(id, await blobToDataUrl(png), target.description);
      if (folderRef.current === id) setExportedAt(res.exportedAt);
      refreshList();
      return res.path;
    },
    reveal: async (id: string) => {
      try {
        await revealProject(id);
      } catch (e) {
        notify(e instanceof Error ? e.message : 'Não consegui abrir a pasta.');
      }
    },
    refreshList,
    refreshFolderImages: () => refreshFolderImages(),
  };

  return {
    project,
    setProject,
    folder,
    online,
    loaded,
    saveState,
    description,
    projects,
    exportedAt,
    switching,
    session,
    folderImages,
    storeImage,
    actions,
  };
}
