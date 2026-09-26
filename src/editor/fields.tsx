import { useId, useRef, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, ImagePlus, Loader2, Trash2, X } from 'lucide-react';
import { fileToDataUrl } from '../engine/image.ts';
import { useStoreImage } from './assets.tsx';

export function Section({
  title,
  hint,
  defaultOpen = false,
  children,
}: {
  title: string;
  hint?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details className="sec" open={defaultOpen}>
      <summary>
        <span className="sec-title">{title}</span>
        {hint && <span className="sec-hint">{hint}</span>}
        <ChevronDown className="sec-chevron" size={16} />
      </summary>
      <div className="sec-body">{children}</div>
    </details>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: (id: string) => ReactNode }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {hint && <span className="field-hint">{hint}</span>}
      </label>
      {children(id)}
    </div>
  );
}

export function TextInput({
  label,
  hint,
  value,
  onChange,
  placeholder,
  maxLength,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
}) {
  return (
    <Field label={label} hint={hint}>
      {(id) => (
        <input
          id={id}
          className="input"
          value={value}
          placeholder={placeholder}
          maxLength={maxLength}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </Field>
  );
}

export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <Field label={label}>
      {(id) => (
        <select id={id} className="input" value={value} onChange={(e) => onChange(e.target.value as T)}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <Field label={label} hint={format(value)}>
      {(id) => (
        <input
          id={id}
          className="slider"
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      )}
    </Field>
  );
}

async function firstImage(files: FileList | File[] | null | undefined): Promise<string | null> {
  const file = Array.from(files ?? []).find((f) => f.type.startsWith('image/'));
  return file ? fileToDataUrl(file) : null;
}

/** Slot de imagem: clique, arraste ou cole (Ctrl+V com o slot focado). A imagem vai para a pasta do projeto. */
export function ImageSlot({
  value,
  onChange,
  label,
  hint,
  size = 'md',
}: {
  value: string | null;
  onChange: (src: string | null) => void;
  label: string;
  /** Prefixo do nome do arquivo salvo (ex.: "principal"); padrão é o rótulo. */
  hint?: string;
  size?: 'lg' | 'md' | 'sm';
}) {
  const storeImage = useStoreImage();
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);

  const accept = async (files: FileList | File[] | null | undefined) => {
    setBusy(true);
    try {
      const dataUrl = await firstImage(files);
      if (dataUrl) onChange(await storeImage(dataUrl, hint ?? label));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={`slot slot-${size}${drag ? ' is-drag' : ''}${value ? ' has-img' : ''}`}
      tabIndex={0}
      role="button"
      aria-label={value ? `${label}: trocar imagem` : `${label}: adicionar imagem`}
      onClick={() => input.current?.click()}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), input.current?.click())}
      onPaste={(e) => accept(e.clipboardData.files)}
      onDragOver={(e) => (e.preventDefault(), setDrag(true))}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        accept(e.dataTransfer.files);
      }}
    >
      {value ? <img src={value} alt="" /> : busy ? <Loader2 className="spin" size={20} /> : <ImagePlus size={size === 'sm' ? 18 : 22} />}
      {!value && size !== 'sm' && <span className="slot-label">{label}</span>}
      {value && (
        <button
          type="button"
          className="slot-clear"
          aria-label="Remover imagem"
          onClick={(e) => {
            e.stopPropagation();
            onChange(null);
          }}
        >
          <X size={14} />
        </button>
      )}
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          accept(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}

/** Controles de reordenar/remover de um item de lista. */
export function RowActions({
  index,
  count,
  onMove,
  onRemove,
}: {
  index: number;
  count: number;
  onMove: (from: number, to: number) => void;
  onRemove: () => void;
}) {
  return (
    <div className="row-actions">
      <button type="button" className="icon-btn" aria-label="Subir" disabled={index === 0} onClick={() => onMove(index, index - 1)}>
        <ArrowUp size={14} />
      </button>
      <button
        type="button"
        className="icon-btn"
        aria-label="Descer"
        disabled={index === count - 1}
        onClick={() => onMove(index, index + 1)}
      >
        <ArrowDown size={14} />
      </button>
      <button type="button" className="icon-btn danger" aria-label="Remover" onClick={onRemove}>
        <Trash2 size={14} />
      </button>
    </div>
  );
}

export function move<T>(list: T[], from: number, to: number) {
  const [item] = list.splice(from, 1);
  list.splice(to, 0, item);
}
