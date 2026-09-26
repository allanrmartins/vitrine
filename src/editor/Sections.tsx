import type { Draft } from 'immer';
import { Eraser, Loader2, Plus, RotateCcw, Undo2 } from 'lucide-react';
import type { AdData, ConditionStatus, DeliveryMode, HeroTreatment, IconRef } from '../types.ts';
import { ACCENTS, BADGE_PRESETS, newExtra, newHighlight, newKitItem } from '../defaults.ts';
import { CONDITION_LABELS, DELIVERY_LABELS } from '../engine/format.ts';
import { ICONS, ICON_NAMES, isIconName } from '../ad/icons.ts';
import { Field, ImageSlot, RowActions, Section, Select, Slider, TextInput, move } from './fields.tsx';
import { setHero, type HeroCutout } from './useHeroCutout.ts';
import { HERO_OFFSET_LIMIT, HERO_SCALE_MAX, HERO_SCALE_MIN } from './useHeroDrag.ts';

export type Update = (fn: (d: Draft<AdData>) => void) => void;
interface Props {
  data: AdData;
  update: Update;
}

export function HeaderSection({ data, update }: Props) {
  return (
    <Section title="Cabeçalho" hint="selo, título, subtítulo" defaultOpen>
      <TextInput label="Selo" value={data.badge} onChange={(v) => update((d) => void (d.badge = v))} maxLength={16} />
      <div className="chips">
        {BADGE_PRESETS.map((b) => (
          <button key={b} type="button" className={`chip${data.badge === b ? ' on' : ''}`} onClick={() => update((d) => void (d.badge = b))}>
            {b}
          </button>
        ))}
      </div>
      <TextInput
        label="Título"
        hint="marca + modelo"
        value={data.title}
        placeholder="Rotor Riot TANQ 2 + DJI O4 Pro"
        onChange={(v) => update((d) => void (d.title = v))}
      />
      <TextInput
        label="Subtítulo"
        hint="categoria + gancho"
        value={data.subtitle}
        placeholder='FPV 5" 6S - Pronto para voar'
        onChange={(v) => update((d) => void (d.subtitle = v))}
      />
    </Section>
  );
}

export function DealSection({ data, update }: Props) {
  return (
    <Section title="Valor e condição" hint="preço, pagamento, estado" defaultOpen>
      <div className="grid-2">
        <TextInput label="Preço" value={data.price.value} placeholder="3500" onChange={(v) => update((d) => void (d.price.value = v))} />
        <TextInput
          label="Preço anterior"
          hint="sai riscado"
          value={data.price.previous}
          onChange={(v) => update((d) => void (d.price.previous = v))}
        />
      </div>
      <div className="grid-2">
        <TextInput
          label="Rótulo do preço"
          hint="opcional"
          value={data.price.label ?? ''}
          placeholder="Com as baterias"
          onChange={(v) => update((d) => void (d.price.label = v))}
        />
        <div />
      </div>
      <div className="grid-2">
        <TextInput
          label="Segundo preço"
          hint="opcional"
          value={data.price.alt?.value ?? ''}
          placeholder="2700"
          onChange={(v) => update((d) => void (d.price.alt = { label: d.price.alt?.label ?? '', value: v }))}
        />
        <TextInput
          label="Rótulo do 2º preço"
          value={data.price.alt?.label ?? ''}
          placeholder="Sem as baterias"
          onChange={(v) => update((d) => void (d.price.alt = { value: d.price.alt?.value ?? '', label: v }))}
        />
      </div>
      <TextInput
        label="Pagamento"
        value={data.price.note}
        placeholder="Pix ou cartão"
        onChange={(v) => update((d) => void (d.price.note = v))}
      />
      <div className="grid-2">
        <Select<ConditionStatus>
          label="Condição"
          value={data.condition.status}
          options={Object.entries(CONDITION_LABELS).map(([value, label]) => ({ value: value as ConditionStatus, label }))}
          onChange={(v) => update((d) => void (d.condition.status = v))}
        />
        <TextInput
          label="Detalhe do estado"
          value={data.condition.note}
          placeholder="3 meses de uso"
          onChange={(v) => update((d) => void (d.condition.note = v))}
        />
      </div>
    </Section>
  );
}

const TREATMENTS: { value: HeroTreatment; label: string }[] = [
  { value: 'blend', label: 'Esfumada no fundo' },
  { value: 'cutout', label: 'Recortada (sem fundo)' },
  { value: 'card', label: 'Cartão com borda' },
];

export function ImagesSection({ data, update, cutout }: Props & { cutout: HeroCutout }) {
  const { main, treatment, transform } = data.images;

  return (
    <Section title="Imagens" hint="principal + até 2 secundárias" defaultOpen>
      <div className="images-row">
        <ImageSlot
          size="lg"
          label="Imagem principal"
          hint="principal"
          value={main}
          onChange={(v) =>
            v
              ? setHero(update, v)
              : update((d) => {
                  d.images.main = null;
                  d.images.mainOriginal = null;
                })
          }
        />
        <div className="images-side">
          {data.images.secondary.map((src, i) => (
            <ImageSlot
              key={i}
              label={i === 0 ? 'Secundária' : 'Terciária'}
              hint={i === 0 ? 'secundaria' : 'terciaria'}
              value={src}
              onChange={(v) => update((d) => void (d.images.secondary[i] = v))}
            />
          ))}
        </div>
      </div>
      {main && (
        <>
          <div className="grid-2 align-end">
            <Select<HeroTreatment>
              label="Tratamento da principal"
              value={treatment}
              options={TREATMENTS}
              onChange={(v) => update((d) => void (d.images.treatment = v))}
            />
            <button type="button" className="btn" onClick={cutout.run} disabled={cutout.busy}>
              {cutout.busy ? <Loader2 className="spin" size={16} /> : <Eraser size={16} />}
              {cutout.label}
            </button>
          </div>
          {cutout.canRestore && (
            <button type="button" className="btn ghost sm" onClick={cutout.restore} disabled={cutout.busy}>
              <Undo2 size={14} /> Restaurar foto original
            </button>
          )}
          {cutout.error && <p className="msg error">{cutout.error}</p>}
          <div className="grid-3">
            <Slider
              label="Zoom"
              value={transform.scale}
              min={HERO_SCALE_MIN}
              max={HERO_SCALE_MAX}
              step={0.01}
              format={(v) => `${Math.round(v * 100)}%`}
              onChange={(v) => update((d) => void (d.images.transform.scale = v))}
            />
            <Slider
              label="Horizontal"
              value={transform.x}
              min={-HERO_OFFSET_LIMIT}
              max={HERO_OFFSET_LIMIT}
              step={1}
              format={(v) => `${v}%`}
              onChange={(v) => update((d) => void (d.images.transform.x = v))}
            />
            <Slider
              label="Vertical"
              value={transform.y}
              min={-HERO_OFFSET_LIMIT}
              max={HERO_OFFSET_LIMIT}
              step={1}
              format={(v) => `${v}%`}
              onChange={(v) => update((d) => void (d.images.transform.y = v))}
            />
          </div>
          <button type="button" className="btn ghost sm" onClick={() => update((d) => void (d.images.transform = { scale: 1, x: 0, y: 0 }))}>
            <RotateCcw size={14} /> Centralizar
          </button>
        </>
      )}
    </Section>
  );
}

function IconPicker({ icon, onChange }: { icon: IconRef; onChange: (i: IconRef) => void }) {
  const mode = icon.kind;
  return (
    <div className="icon-picker">
      <select
        className="input"
        aria-label="Ícone"
        value={icon.kind === 'icon' ? icon.name : `:${icon.kind}`}
        onChange={(e) => {
          const v = e.target.value;
          if (v === ':text') onChange({ kind: 'text', value: 'TXT' });
          else if (v === ':image') onChange({ kind: 'image', src: '' });
          else if (isIconName(v)) onChange({ kind: 'icon', name: v });
        }}
      >
        <optgroup label="Outros">
          <option value=":text">Sigla (texto)</option>
          <option value=":image">Imagem própria</option>
        </optgroup>
        <optgroup label="Ícones">
          {ICON_NAMES.map((n) => (
            <option key={n} value={n}>
              {ICONS[n].label}
            </option>
          ))}
        </optgroup>
      </select>
      {mode === 'text' && (
        <input
          className="input mono"
          aria-label="Sigla"
          maxLength={4}
          value={icon.kind === 'text' ? icon.value : ''}
          onChange={(e) => onChange({ kind: 'text', value: e.target.value.toUpperCase() })}
        />
      )}
      {mode === 'image' && (
        <ImageSlot
          size="sm"
          label="Ícone"
          hint="icone"
          value={icon.kind === 'image' && icon.src ? icon.src : null}
          onChange={(src) => onChange(src ? { kind: 'image', src } : { kind: 'icon', name: 'check' })}
        />
      )}
      {mode === 'icon' && icon.kind === 'icon' && (
        <span className="icon-preview">{(() => { const { Icon } = ICONS[icon.name]; return <Icon size={18} />; })()}</span>
      )}
    </div>
  );
}

export function HighlightsSection({ data, update }: Props) {
  const items = data.highlights.items;
  return (
    <Section title="Destaques" hint="coluna da esquerda">
      <TextInput label="Título da seção" value={data.highlights.title} onChange={(v) => update((d) => void (d.highlights.title = v))} />
      {items.map((h, i) => (
        <div className="card" key={h.id}>
          <div className="card-head">
            <IconPicker icon={h.icon} onChange={(icon) => update((d) => void (d.highlights.items[i].icon = icon))} />
            <RowActions
              index={i}
              count={items.length}
              onMove={(a, b) => update((d) => move(d.highlights.items, a, b))}
              onRemove={() => update((d) => void d.highlights.items.splice(i, 1))}
            />
          </div>
          <Field label="Texto">
            {(id) => (
              <textarea
                id={id}
                className="input"
                rows={2}
                value={h.text}
                onChange={(e) => update((d) => void (d.highlights.items[i].text = e.target.value))}
              />
            )}
          </Field>
          <TextInput
            label="Ênfase"
            hint="opcional, sai colorida"
            value={h.emphasis}
            onChange={(v) => update((d) => void (d.highlights.items[i].emphasis = v))}
          />
        </div>
      ))}
      <button type="button" className="btn ghost" onClick={() => update((d) => void d.highlights.items.push(newHighlight()))}>
        <Plus size={16} /> Adicionar destaque
      </button>
    </Section>
  );
}

export function ExtrasSection({ data, update }: Props) {
  const items = data.extras.items;
  return (
    <Section title="Diferenciais" hint="coluna da direita + miniaturas">
      <TextInput label="Título da seção" value={data.extras.title} onChange={(v) => update((d) => void (d.extras.title = v))} />
      <p className="msg">Itens com foto também aparecem na faixa de miniaturas.</p>
      {items.map((e, i) => (
        <div className="card row" key={e.id}>
          <ImageSlot size="sm" label="Foto" hint="diferencial" value={e.image} onChange={(v) => update((d) => void (d.extras.items[i].image = v))} />
          <input
            className="input grow"
            aria-label="Diferencial"
            value={e.text}
            onChange={(ev) => update((d) => void (d.extras.items[i].text = ev.target.value))}
          />
          <RowActions
            index={i}
            count={items.length}
            onMove={(a, b) => update((d) => move(d.extras.items, a, b))}
            onRemove={() => update((d) => void d.extras.items.splice(i, 1))}
          />
        </div>
      ))}
      <button type="button" className="btn ghost" onClick={() => update((d) => void d.extras.items.push(newExtra()))}>
        <Plus size={16} /> Adicionar diferencial
      </button>
    </Section>
  );
}

export function KitSection({ data, update }: Props) {
  const items = data.kit.items;
  return (
    <Section title="O que acompanha" hint="acessórios">
      <div className="grid-2">
        <TextInput label="Título" value={data.kit.title} onChange={(v) => update((d) => void (d.kit.title = v))} />
        <TextInput label="Complemento" value={data.kit.note} placeholder="kit completo" onChange={(v) => update((d) => void (d.kit.note = v))} />
      </div>
      {items.map((k, i) => (
        <div className="card row" key={k.id}>
          <ImageSlot size="sm" label="Foto" hint="kit" value={k.image} onChange={(v) => update((d) => void (d.kit.items[i].image = v))} />
          <input
            className="input grow"
            aria-label="Item"
            value={k.label}
            placeholder="1x Bateria 6S 1100 mAh"
            onChange={(ev) => update((d) => void (d.kit.items[i].label = ev.target.value))}
          />
          <RowActions
            index={i}
            count={items.length}
            onMove={(a, b) => update((d) => move(d.kit.items, a, b))}
            onRemove={() => update((d) => void d.kit.items.splice(i, 1))}
          />
        </div>
      ))}
      <button type="button" className="btn ghost" onClick={() => update((d) => void d.kit.items.push(newKitItem()))}>
        <Plus size={16} /> Adicionar item
      </button>
    </Section>
  );
}

export function DeliverySection({ data, update }: Props) {
  const toggle = (m: DeliveryMode) =>
    update((d) => {
      const i = d.delivery.modes.indexOf(m);
      if (i >= 0) d.delivery.modes.splice(i, 1);
      else d.delivery.modes.push(m);
    });
  return (
    <Section title="Entrega" hint="frete e retirada">
      <div className="chips">
        {(Object.keys(DELIVERY_LABELS) as DeliveryMode[]).map((m) => (
          <button key={m} type="button" className={`chip${data.delivery.modes.includes(m) ? ' on' : ''}`} aria-pressed={data.delivery.modes.includes(m)} onClick={() => toggle(m)}>
            {DELIVERY_LABELS[m]}
          </button>
        ))}
      </div>
      <div className="grid-2">
        <TextInput label="Local" hint="cidade / região" value={data.delivery.location} placeholder="SP" onChange={(v) => update((d) => void (d.delivery.location = v))} />
        <TextInput label="Observação" value={data.delivery.note} placeholder="Localizado em São Paulo" onChange={(v) => update((d) => void (d.delivery.note = v))} />
      </div>
    </Section>
  );
}

export function FinishSection({ data, update }: Props) {
  return (
    <Section title="Chamada e cores" hint="rodapé e tema">
      <TextInput label="Chamada final" value={data.cta} onChange={(v) => update((d) => void (d.cta = v))} />
      <div className="swatches">
        {ACCENTS.map((a) => (
          <button
            key={a.name}
            type="button"
            className={`swatch${data.theme.accent === a.accent ? ' on' : ''}`}
            style={{ background: `linear-gradient(135deg, ${a.accent} 60%, ${a.highlight} 60%)` }}
            aria-label={a.name}
            title={a.name}
            onClick={() => update((d) => void (d.theme = { accent: a.accent, highlight: a.highlight }))}
          />
        ))}
      </div>
      <div className="grid-2">
        <Field label="Cor principal">
          {(id) => <input id={id} type="color" className="color" value={data.theme.accent} onChange={(e) => update((d) => void (d.theme.accent = e.target.value))} />}
        </Field>
        <Field label="Cor de ênfase">
          {(id) => <input id={id} type="color" className="color" value={data.theme.highlight} onChange={(e) => update((d) => void (d.theme.highlight = e.target.value))} />}
        </Field>
      </div>
    </Section>
  );
}
