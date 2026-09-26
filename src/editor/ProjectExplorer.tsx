import { useEffect, useReducer, useRef, useState } from 'react';
import { ChevronsLeft, ChevronsRight, FileJson, FolderInput, FolderOpen, ImageOff, Loader2, Plus, RefreshCw } from 'lucide-react';
import type { ProjectSummary } from '../engine/projects.ts';
import { relativeTime } from '../engine/format.ts';
import type { SaveState } from './useWorkspace.ts';

function readCollapsed(): boolean {
  try {
    return localStorage.getItem('vitrine:explorer-collapsed') === '1';
  } catch {
    return false;
  }
}

/** Explorador de projetos: uma linha por pasta em Anuncios/. Clicar abre (o atual é salvo antes). */
export function ProjectExplorer({
  online,
  projects,
  current,
  switching,
  saveState,
  onOpen,
  onNew,
  onRefresh,
  onReveal,
  onImport,
  onExportJson,
}: {
  online: boolean;
  projects: ProjectSummary[] | null;
  current: string | null;
  switching: string | null;
  saveState: SaveState;
  onOpen: (id: string) => void;
  onNew: () => void;
  onRefresh: () => void;
  onReveal: (id: string) => void;
  onImport: (file: File) => void;
  onExportJson: () => void;
}) {
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const fileRef = useRef<HTMLInputElement>(null);
  // Re-renderiza a cada minuto para os "há X min" andarem sozinhos.
  const [, tick] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    const t = setInterval(tick, 60_000);
    return () => clearInterval(t);
  }, []);

  const toggle = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem('vitrine:explorer-collapsed', c ? '0' : '1');
      } catch {
        // Preferência só local; sem storage o explorador abre expandido.
      }
      return !c;
    });
  };

  if (collapsed) {
    return (
      <nav className="explorer is-collapsed" aria-label="Projetos">
        <button type="button" className="icon-btn" aria-label="Mostrar projetos" title="Mostrar projetos" onClick={toggle}>
          <ChevronsRight size={16} />
        </button>
        <button type="button" className="icon-btn" aria-label="Novo anúncio" title="Novo anúncio" onClick={onNew}>
          <Plus size={16} />
        </button>
        {projects?.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`explorer-mini${p.id === current ? ' on' : ''}`}
            title={`${p.title} (Anuncios/${p.id})`}
            aria-label={`Abrir ${p.title}`}
            onClick={() => onOpen(p.id)}
          >
            {p.thumb ? <img src={p.thumb} alt="" /> : <span>{p.id.slice(0, 2)}</span>}
          </button>
        ))}
      </nav>
    );
  }

  return (
    <nav className="explorer" aria-label="Projetos">
      <div className="explorer-head">
        <span className="explorer-title">Projetos</span>
        <span className="explorer-count">{projects?.length ?? ''}</span>
        <button type="button" className="icon-btn push" aria-label="Atualizar lista" title="Atualizar lista" onClick={onRefresh} disabled={!online}>
          <RefreshCw size={14} />
        </button>
        <button type="button" className="icon-btn" aria-label="Recolher" title="Recolher" onClick={toggle}>
          <ChevronsLeft size={16} />
        </button>
      </div>

      <button type="button" className="btn primary sm explorer-new" onClick={onNew}>
        <Plus size={15} /> Novo anúncio
      </button>

      <div className="explorer-root">
        <FolderOpen size={13} /> Anuncios
      </div>

      {!online ? (
        <p className="explorer-empty">Sem o servidor local não há acesso à pasta Anuncios. Rode pelo atalho ou `npm run dev`.</p>
      ) : projects === null ? (
        <p className="explorer-empty">
          <Loader2 className="spin" size={14} /> Lendo pastas...
        </p>
      ) : projects.length === 0 ? (
        <p className="explorer-empty">Nenhum projeto ainda. Crie o primeiro em "Novo anúncio".</p>
      ) : (
        <ul className="explorer-list">
          {projects.map((p) => {
            const active = p.id === current;
            return (
              <li key={p.id} className={`explorer-item${active ? ' on' : ''}`}>
                <button
                  type="button"
                  className="explorer-open"
                  aria-current={active ? 'true' : undefined}
                  disabled={!!switching}
                  onClick={() => onOpen(p.id)}
                >
                  <span className="explorer-thumb">{p.thumb ? <img src={p.thumb} alt="" /> : <ImageOff size={14} />}</span>
                  <span className="explorer-info">
                    <strong>{p.title}</strong>
                    <span>
                      {active && saveState === 'saving' ? 'salvando...' : relativeTime(p.updatedAt)} · {p.id}
                    </span>
                  </span>
                  {switching === p.id && <Loader2 className="spin" size={14} />}
                </button>
                <button
                  type="button"
                  className="icon-btn explorer-reveal"
                  aria-label={`Abrir a pasta ${p.id} no Explorer`}
                  title="Abrir pasta no Explorer"
                  onClick={() => onReveal(p.id)}
                >
                  <FolderInput size={14} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="explorer-foot">
        <button type="button" className="btn ghost sm" onClick={() => fileRef.current?.click()}>
          <FolderOpen size={14} /> Importar .json
        </button>
        <button type="button" className="btn ghost sm" onClick={onExportJson}>
          <FileJson size={14} /> Exportar .json
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) onImport(f);
          }}
        />
      </div>
    </nav>
  );
}
