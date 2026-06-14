/**
 * Builder vizual pentru Landing Pages: adaugi/reordonezi (drag&drop sau ↑↓) și editezi blocuri din
 * UI, fără cod. Blocurile se compilează în `html` la salvare (vezi LpEditor) — serveLp servește tot
 * `html`. Editezi doar conținut + aranjare; design-ul (culori/fundal) vine din tabul Design.
 */
import { useRef, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { LP_BLOCK_TYPES, defaultBlockProps, type LpBlock, type LpBlockType } from '../types/lpBlocks';
import type { LpFormConfig } from '../types/landingPage';

type FieldKind = 'text' | 'textarea' | 'url' | 'number' | 'align' | 'select' | 'items';
interface Field {
  k: string;
  t: FieldKind;
  opts?: string[];
  item?: { k: string; t: FieldKind }[];
}

const BLOCK_FIELDS: Record<LpBlockType, Field[]> = {
  hero: [{ k: 'heading', t: 'text' }, { k: 'subheading', t: 'textarea' }, { k: 'ctaText', t: 'text' }, { k: 'ctaHref', t: 'url' }, { k: 'align', t: 'align' }],
  heading: [{ k: 'text', t: 'text' }, { k: 'level', t: 'select', opts: ['h2', 'h3'] }, { k: 'align', t: 'align' }],
  text: [{ k: 'text', t: 'textarea' }, { k: 'align', t: 'align' }],
  image: [{ k: 'url', t: 'url' }, { k: 'alt', t: 'text' }, { k: 'width', t: 'number' }],
  button: [{ k: 'text', t: 'text' }, { k: 'href', t: 'url' }, { k: 'align', t: 'align' }],
  features: [{ k: 'columns', t: 'number' }, { k: 'items', t: 'items', item: [{ k: 'title', t: 'text' }, { k: 'body', t: 'textarea' }] }],
  testimonial: [{ k: 'quote', t: 'textarea' }, { k: 'author', t: 'text' }],
  faq: [{ k: 'items', t: 'items', item: [{ k: 'q', t: 'text' }, { k: 'a', t: 'textarea' }] }],
  form: [{ k: 'heading', t: 'text' }],
  spacer: [{ k: 'size', t: 'number' }],
};

function newId(): string {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  } catch (e) { /* ignore */ }
  return `b${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export default function LpVisualBuilder({
  blocks,
  form,
  onChange,
}: {
  blocks: LpBlock[];
  form: LpFormConfig;
  onChange: (blocks: LpBlock[]) => void;
}) {
  const { t } = useTranslation();
  const [sel, setSel] = useState<string | null>(blocks[0]?.id ?? null);
  const dragIndex = useRef<number | null>(null);

  const field: CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 8px', fontSize: 13, background: 'var(--bg-0)', color: 'var(--fg-0)' };
  const label: CSSProperties = { display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--fg-1)', margin: '10px 0 3px' };
  const btn: CSSProperties = { border: '1px solid var(--border)', borderRadius: 7, padding: '5px 9px', fontSize: 12, fontWeight: 600, cursor: 'pointer', background: 'var(--bg-0)', color: 'var(--fg-0)' };

  const addBlock = (type: LpBlockType) => {
    const b: LpBlock = { id: newId(), type, props: defaultBlockProps(type) };
    onChange([...blocks, b]);
    setSel(b.id);
  };
  const setProps = (id: string, props: Record<string, unknown>) => onChange(blocks.map((b) => (b.id === id ? { ...b, props } : b)));
  const remove = (id: string) => {
    onChange(blocks.filter((b) => b.id !== id));
    if (sel === id) setSel(null);
  };
  const move = (i: number, dir: number) => {
    const j = i + dir;
    if (j < 0 || j >= blocks.length) return;
    const copy = [...blocks];
    [copy[i], copy[j]] = [copy[j], copy[i]];
    onChange(copy);
  };
  const drop = (i: number) => {
    const from = dragIndex.current;
    dragIndex.current = null;
    if (from === null || from === i) return;
    const copy = [...blocks];
    const [m] = copy.splice(from, 1);
    copy.splice(i, 0, m);
    onChange(copy);
  };

  const selected = blocks.find((b) => b.id === sel) || null;

  const renderField = (f: Field, props: Record<string, unknown>, onPatch: (patch: Record<string, unknown>) => void) => {
    const val = props[f.k];
    const lbl = t(`admin.lpStudio.bf_${f.k}`);
    if (f.t === 'textarea') return (<><label style={label}>{lbl}</label><textarea value={typeof val === 'string' ? val : ''} onChange={(e) => onPatch({ [f.k]: e.target.value })} rows={3} style={{ ...field, fontFamily: 'inherit', resize: 'vertical' }} /></>);
    if (f.t === 'number') return (<><label style={label}>{lbl}</label><input type="number" value={typeof val === 'number' ? val : ''} onChange={(e) => onPatch({ [f.k]: Number(e.target.value) })} style={field} /></>);
    if (f.t === 'align') return (<><label style={label}>{lbl}</label><select value={typeof val === 'string' ? val : 'left'} onChange={(e) => onPatch({ [f.k]: e.target.value })} style={field}><option value="left">{t('admin.lpStudio.alignLeft')}</option><option value="center">{t('admin.lpStudio.alignCenter')}</option><option value="right">{t('admin.lpStudio.alignRight')}</option></select></>);
    if (f.t === 'select') return (<><label style={label}>{lbl}</label><select value={typeof val === 'string' ? val : (f.opts?.[0] || '')} onChange={(e) => onPatch({ [f.k]: e.target.value })} style={field}>{(f.opts || []).map((o) => <option key={o} value={o}>{o}</option>)}</select></>);
    if (f.t === 'items') {
      const items = Array.isArray(val) ? (val as Record<string, unknown>[]) : [];
      const sub = f.item || [];
      const setItems = (next: Record<string, unknown>[]) => onPatch({ [f.k]: next });
      return (
        <>
          <label style={label}>{lbl}</label>
          {items.map((it, ii) => (
            <div key={ii} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 8, marginBottom: 8 }}>
              {sub.map((sf) => (
                <div key={sf.k}>
                  {sf.t === 'textarea'
                    ? <textarea value={typeof it[sf.k] === 'string' ? (it[sf.k] as string) : ''} placeholder={t(`admin.lpStudio.bf_${sf.k}`)} onChange={(e) => setItems(items.map((x, xi) => (xi === ii ? { ...x, [sf.k]: e.target.value } : x)))} rows={2} style={{ ...field, fontFamily: 'inherit', marginBottom: 6, resize: 'vertical' }} />
                    : <input value={typeof it[sf.k] === 'string' ? (it[sf.k] as string) : ''} placeholder={t(`admin.lpStudio.bf_${sf.k}`)} onChange={(e) => setItems(items.map((x, xi) => (xi === ii ? { ...x, [sf.k]: e.target.value } : x)))} style={{ ...field, marginBottom: 6 }} />}
                </div>
              ))}
              <button onClick={() => setItems(items.filter((_, xi) => xi !== ii))} style={{ ...btn, padding: '3px 8px', color: '#c0392b' }}>{t('admin.lpStudio.removeItem')}</button>
            </div>
          ))}
          <button onClick={() => setItems([...items, Object.fromEntries(sub.map((sf) => [sf.k, '']))])} style={btn}>+ {t('admin.lpStudio.addItem')}</button>
        </>
      );
    }
    // text / url
    return (<><label style={label}>{lbl}</label><input type={f.t === 'url' ? 'url' : 'text'} value={typeof val === 'string' ? val : ''} onChange={(e) => onPatch({ [f.k]: e.target.value })} style={field} /></>);
  };

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12, maxHeight: 460, overflowY: 'auto' }}>
      {/* Paleta */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        {LP_BLOCK_TYPES.map((type) => (
          <button key={type} onClick={() => addBlock(type)} style={{ ...btn, padding: '4px 9px' }}>+ {t(`admin.lpStudio.bt_${type}`)}</button>
        ))}
      </div>

      {blocks.length === 0 ? <p style={{ fontSize: 13, color: 'var(--fg-1)' }}>{t('admin.lpStudio.builderEmpty')}</p> : null}

      {/* Lista de blocuri (drag&drop reorder) */}
      {blocks.map((b, i) => (
        <div
          key={b.id}
          draggable
          onDragStart={() => { dragIndex.current = i; }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => drop(i)}
          onClick={() => setSel(b.id)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '7px 9px', marginBottom: 6,
            border: sel === b.id ? '1px solid var(--accent)' : '1px solid var(--border)',
            borderRadius: 8, background: sel === b.id ? 'var(--bg-0)' : 'var(--bg-1)', cursor: 'grab',
          }}
        >
          <span style={{ color: 'var(--fg-1)', cursor: 'grab' }}>⠿</span>
          <span style={{ flex: 1, fontSize: 13, fontWeight: sel === b.id ? 700 : 600, color: 'var(--fg-0)' }}>{t(`admin.lpStudio.bt_${b.type}`)}</span>
          <button onClick={(e) => { e.stopPropagation(); move(i, -1); }} disabled={i === 0} style={{ ...btn, padding: '2px 7px', opacity: i === 0 ? 0.4 : 1 }}>↑</button>
          <button onClick={(e) => { e.stopPropagation(); move(i, 1); }} disabled={i === blocks.length - 1} style={{ ...btn, padding: '2px 7px', opacity: i === blocks.length - 1 ? 0.4 : 1 }}>↓</button>
          <button onClick={(e) => { e.stopPropagation(); remove(b.id); }} style={{ ...btn, padding: '2px 7px', color: '#c0392b' }}>✕</button>
        </div>
      ))}

      {/* Editor proprietăți pentru blocul selectat */}
      {selected ? (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '2px solid var(--border)' }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{t(`admin.lpStudio.bt_${selected.type}`)}</div>
          {selected.type === 'form' ? <p style={{ fontSize: 11, color: 'var(--fg-1)', margin: '6px 0 0' }}>{t('admin.lpStudio.formBlockHint', { count: form.fields.length })}</p> : null}
          {BLOCK_FIELDS[selected.type].map((f) => (
            <div key={f.k}>{renderField(f, selected.props, (patch) => setProps(selected.id, { ...selected.props, ...patch }))}</div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
