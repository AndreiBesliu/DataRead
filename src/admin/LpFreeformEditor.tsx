/**
 * Editor de plasare liberă (decor effect 'custom'): așezi individual forme pe o pânză prin drag,
 * le selectezi și le editezi (formă/mărime/rotație/opacitate/culoare/animație). Scena are o
 * interacțiune (parallax mouse/scroll). Elementele se compilează în DOM pozitionat (compileDecor).
 */
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import {
  LP_DECOR_INTERACTIONS,
  LP_ELEMENT_ANIMS,
  LP_ELEMENT_SHAPES,
  defaultElement,
  elementStyle,
  type LpDecor,
  type LpDecorInteraction,
  type LpElement,
  type LpElementAnim,
  type LpElementShape,
} from '../types/lpDecor';

function newId(): string {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  } catch (e) { /* ignore */ }
  return `e${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export default function LpFreeformEditor({ value, onChange, onClose }: { value: LpDecor; onChange: (d: LpDecor) => void; onClose: () => void }) {
  const { t } = useTranslation();
  const els = value.elements || [];
  const [sel, setSel] = useState<string | null>(els[0]?.id ?? null);
  const [dragId, setDragId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const setEls = (next: LpElement[]) => onChange({ ...value, elements: next });
  const update = (id: string, patch: Partial<LpElement>) => setEls(els.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  const add = (shape: LpElementShape) => {
    const e = { ...defaultElement(shape), id: newId(), x: 50, y: 50 };
    setEls([...els, e]);
    setSel(e.id);
  };
  const remove = (id: string) => { setEls(els.filter((e) => e.id !== id)); if (sel === id) setSel(null); };

  useEffect(() => {
    if (!dragId) return;
    const move = (e: MouseEvent) => {
      const r = canvasRef.current?.getBoundingClientRect();
      if (!r) return;
      const x = Math.min(100, Math.max(0, Math.round(((e.clientX - r.left) / r.width) * 100)));
      const y = Math.min(100, Math.max(0, Math.round(((e.clientY - r.top) / r.height) * 100)));
      update(dragId, { x, y });
    };
    const up = () => setDragId(null);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragId, els]);

  const selected = els.find((e) => e.id === sel) || null;

  const overlay: CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '24px 16px', zIndex: 60, overflowY: 'auto' };
  const panel: CSSProperties = { width: '100%', maxWidth: 900, background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 12, padding: 18, color: 'var(--fg-0)', boxShadow: '0 18px 50px rgba(0,0,0,0.5)' };
  const btn: CSSProperties = { border: '1px solid var(--border)', borderRadius: 7, padding: '5px 9px', fontSize: 12, fontWeight: 600, cursor: 'pointer', background: 'var(--bg-0)', color: 'var(--fg-0)' };
  const field: CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 8px', fontSize: 13, background: 'var(--bg-0)', color: 'var(--fg-0)' };
  const label: CSSProperties = { display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--fg-1)', margin: '10px 0 3px' };

  return (
    <div style={overlay} onClick={onClose}>
      <div style={panel} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <h2 style={{ fontSize: 17, margin: 0 }}>🎨 {t('admin.lpStudio.ff_title')}</h2>
          <span style={{ fontSize: 12, color: 'var(--fg-1)' }}>{t('admin.lpStudio.ff_hint')}</span>
          <button onClick={onClose} style={{ ...btn, marginLeft: 'auto' }}>{t('admin.lpStudio.ff_done')}</button>
        </div>

        {/* Paletă + interacțiune scenă */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginBottom: 10 }}>
          {LP_ELEMENT_SHAPES.map((sh) => (
            <button key={sh} onClick={() => add(sh)} style={{ ...btn, padding: '4px 8px' }}>+ {t(`admin.lpStudio.sh_${sh}`)}</button>
          ))}
          <label style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--fg-1)', display: 'flex', alignItems: 'center', gap: 6 }}>
            {t('admin.lpStudio.decor_interaction')}
            <select value={value.interaction} onChange={(e) => onChange({ ...value, interaction: e.target.value as LpDecorInteraction })} style={{ ...field, width: 'auto' }}>
              {LP_DECOR_INTERACTIONS.map((it) => <option key={it} value={it}>{t(`admin.lpStudio.decorInter_${it}`)}</option>)}
            </select>
          </label>
        </div>

        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          {/* Pânza */}
          <div
            ref={canvasRef}
            style={{ flex: '1 1 460px', minWidth: 300, position: 'relative', height: 360, background: 'radial-gradient(#243154 1px, transparent 1px) 0 0 / 22px 22px, #0a0f1e', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', '--accent': '#38bdf8' } as CSSProperties}
            onMouseDown={() => setSel(null)}
          >
            {els.length === 0 ? <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8a9ac0', fontSize: 13 }}>{t('admin.lpStudio.ff_empty')}</div> : null}
            {els.map((el) => (
              <div
                key={el.id}
                onMouseDown={(e) => { e.stopPropagation(); setSel(el.id); setDragId(el.id); }}
                style={{ position: 'absolute', left: `${el.x}%`, top: `${el.y}%`, transform: 'translate(-50%,-50%)', cursor: 'grab', outline: sel === el.id ? '2px dashed #38bdf8' : 'none', outlineOffset: 4 }}
                title={t(`admin.lpStudio.sh_${el.shape}`)}
              >
                <div style={elementStyle(el) as CSSProperties} />
              </div>
            ))}
          </div>

          {/* Proprietăți */}
          <div style={{ flex: '1 1 220px', minWidth: 220 }}>
            {selected ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--accent)', textTransform: 'uppercase' }}>{t(`admin.lpStudio.sh_${selected.shape}`)}</div>
                  <button onClick={() => remove(selected.id)} style={{ ...btn, marginLeft: 'auto', padding: '3px 8px', color: '#c0392b' }}>{t('admin.lpStudio.ff_delete')}</button>
                </div>
                <label style={label}>{t('admin.lpStudio.ff_shape')}</label>
                <select value={selected.shape} onChange={(e) => update(selected.id, { shape: e.target.value as LpElementShape })} style={field}>
                  {LP_ELEMENT_SHAPES.map((sh) => <option key={sh} value={sh}>{t(`admin.lpStudio.sh_${sh}`)}</option>)}
                </select>
                <label style={label}>{t('admin.lpStudio.ff_size')}: {selected.size}</label>
                <input type="range" min={4} max={200} value={selected.size} onChange={(e) => update(selected.id, { size: Number(e.target.value) })} style={{ width: '100%' }} />
                <label style={label}>{t('admin.lpStudio.ff_rotation')}: {selected.rotation}°</label>
                <input type="range" min={-180} max={180} value={selected.rotation} onChange={(e) => update(selected.id, { rotation: Number(e.target.value) })} style={{ width: '100%' }} />
                <label style={label}>{t('admin.lpStudio.decor_opacity')}: {selected.opacity}</label>
                <input type="range" min={0.05} max={1} step={0.05} value={selected.opacity} onChange={(e) => update(selected.id, { opacity: Number(e.target.value) })} style={{ width: '100%' }} />
                <label style={label}>{t('admin.lpStudio.ff_anim')}</label>
                <select value={selected.anim} onChange={(e) => update(selected.id, { anim: e.target.value as LpElementAnim })} style={field}>
                  {LP_ELEMENT_ANIMS.map((a) => <option key={a} value={a}>{t(`admin.lpStudio.ffAnim_${a}`)}</option>)}
                </select>
                <label style={{ ...label, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={!selected.color} onChange={(e) => update(selected.id, { color: e.target.checked ? '' : '#38bdf8' })} />
                  {t('admin.lpStudio.decor_useAccent')}
                </label>
                {selected.color ? <input type="color" value={selected.color} onChange={(e) => update(selected.id, { color: e.target.value })} style={{ width: 48, height: 30, border: '1px solid var(--border)', borderRadius: 6, background: 'transparent', cursor: 'pointer' }} /> : null}
              </>
            ) : (
              <p style={{ fontSize: 13, color: 'var(--fg-1)' }}>{t('admin.lpStudio.ff_selectHint')}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
