import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Loader2, X } from 'lucide-react';
import { slugify } from '../engine/format.ts';

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => d?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => e.target === ref.current && onClose()}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <button type="button" className="icon-btn" aria-label="Fechar" onClick={onClose}>
          <X size={16} />
        </button>
      </div>
      {children}
    </dialog>
  );
}

export function NewProjectDialog({
  online,
  onCreate,
  onClose,
}: {
  online: boolean;
  onCreate: (name: string) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const slug = slugify(name);

  const submit = async () => {
    if (online && !name.trim()) return;
    setBusy(true);
    setError('');
    try {
      await onCreate(name.trim());
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não consegui criar a pasta.');
      setBusy(false);
    }
  };

  return (
    <Modal title="Novo anúncio" onClose={onClose}>
      <form
        className="modal-body"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        {online ? (
          <>
            <div className="field">
              <label htmlFor="new-name">Nome do projeto</label>
              <input
                id="new-name"
                className="input"
                autoFocus
                placeholder="ex.: tanq, cadeira gamer, iphone 13"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <p className="msg">
              Pasta: <code>Anuncios/{name.trim() ? slug : '...'}</code>
            </p>
          </>
        ) : (
          <p className="msg">O anúncio atual será substituído por um em branco. Sem o servidor local, ele fica salvo só neste navegador.</p>
        )}
        {error && <p className="msg error">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn primary" disabled={busy || (online && !name.trim())}>
            {busy && <Loader2 className="spin" size={16} />} Criar
          </button>
        </div>
      </form>
    </Modal>
  );
}
