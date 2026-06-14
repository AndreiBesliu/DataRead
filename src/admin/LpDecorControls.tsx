/**
 * Controale pentru un decor (LpDecor): efect, interacțiune, densitate/viteză/mărime/opacitate, culoare
 * + mini-preview live (iframe sandbox cu compileDecor). Refolosit pt. fundalul paginii (tab Design) și
 * pentru blocul decor (builder vizual).
 */
import { useEffect, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { LP_DECOR_EFFECTS, LP_DECOR_INTERACTIONS, compileDecor, type LpDecor, type LpDecorEffect, type LpDecorInteraction } from '../types/lpDecor';
import LpFreeformEditor from './LpFreeformEditor';

export default function LpDecorControls({ value, onChange }: { value: LpDecor; onChange: (d: LpDecor) => void }) {
  const { t } = useTranslation();
  const [preview, setPreview] = useState('');
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => {
      if (value.effect === 'none') {
        setPreview('');
        return;
      }
      const accent = value.color || '#38bdf8';
      const doc = `<!doctype html><html><head><meta charset="utf-8"><style>:root{--accent:${accent}}html,body{margin:0;height:100%}body{background:#0a0f1e}#wrap{position:relative;width:100%;height:150px}</style></head><body><div id="wrap">${compileDecor(value, 'mini', 'block')}</div></body></html>`;
      setPreview(doc);
    }, 350);
    return () => clearTimeout(id);
  }, [value]);

  const field: CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 8px', fontSize: 13, background: 'var(--bg-0)', color: 'var(--fg-0)' };
  const label: CSSProperties = { display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--fg-1)', margin: '12px 0 4px' };
  const rangeRow = (key: 'density' | 'speed' | 'size' | 'opacity', min: number, max: number, step: number) => (
    <div>
      <label style={label}>{t(`admin.lpStudio.decor_${key}`)}: {value[key]}</label>
      <input type="range" min={min} max={max} step={step} value={value[key]} onChange={(e) => onChange({ ...value, [key]: Number(e.target.value) })} style={{ width: '100%' }} />
    </div>
  );

  return (
    <div>
      <label style={label}>{t('admin.lpStudio.decor_effect')}</label>
      <select value={value.effect} onChange={(e) => onChange({ ...value, effect: e.target.value as LpDecorEffect })} style={field}>
        {LP_DECOR_EFFECTS.map((ef) => <option key={ef} value={ef}>{t(`admin.lpStudio.decorEffect_${ef}`)}</option>)}
      </select>

      {value.effect === 'custom' ? (
        <>
          <p style={{ fontSize: 11, color: 'var(--fg-1)', marginTop: 10 }}>{t('admin.lpStudio.decor_customHint')}</p>
          <button onClick={() => setEditing(true)} style={{ border: '1px solid var(--accent)', background: 'var(--accent)', color: 'var(--accent-contrast)', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginTop: 6 }}>{t('admin.lpStudio.decor_editElements', { count: (value.elements || []).length })}</button>
          {preview ? (<><label style={label}>{t('admin.lpStudio.decor_preview')}</label><iframe title="decor-preview" srcDoc={preview} sandbox="allow-scripts" style={{ width: '100%', height: 150, border: '1px solid var(--border)', borderRadius: 8 }} /></>) : null}
        </>
      ) : value.effect !== 'none' ? (
        <>
          <label style={label}>{t('admin.lpStudio.decor_interaction')}</label>
          <select value={value.interaction} onChange={(e) => onChange({ ...value, interaction: e.target.value as LpDecorInteraction })} style={field}>
            {LP_DECOR_INTERACTIONS.map((it) => <option key={it} value={it}>{t(`admin.lpStudio.decorInter_${it}`)}</option>)}
          </select>

          {rangeRow('density', 1, 100, 1)}
          {rangeRow('speed', 0, 100, 1)}
          {rangeRow('size', 1, 20, 1)}
          {rangeRow('opacity', 0.05, 1, 0.05)}

          <label style={{ ...label, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={!value.color} onChange={(e) => onChange({ ...value, color: e.target.checked ? '' : '#38bdf8' })} />
            {t('admin.lpStudio.decor_useAccent')}
          </label>
          {value.color ? (
            <input type="color" value={value.color} onChange={(e) => onChange({ ...value, color: e.target.value })} style={{ width: 48, height: 30, border: '1px solid var(--border)', borderRadius: 6, background: 'transparent', cursor: 'pointer' }} />
          ) : null}

          {preview ? (
            <>
              <label style={label}>{t('admin.lpStudio.decor_preview')}</label>
              <iframe title="decor-preview" srcDoc={preview} sandbox="allow-scripts" style={{ width: '100%', height: 150, border: '1px solid var(--border)', borderRadius: 8 }} />
            </>
          ) : null}
        </>
      ) : null}
      {editing ? <LpFreeformEditor value={value} onChange={onChange} onClose={() => setEditing(false)} /> : null}
    </div>
  );
}
