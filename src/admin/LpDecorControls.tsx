/**
 * Controale pentru un decor (LpDecor): efect, interacțiune + intensitate, densitate/viteză/mărime/
 * opacitate, culoare. Previzualizarea se face în panoul mare de previzualizare al LP (nu aici).
 * Refolosit pt. fundalul paginii (tab Design) și pentru fundalul oricărui bloc (builder vizual).
 */
import { useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { LP_DECOR_EFFECTS, LP_DECOR_INTERACTIONS, type LpDecor, type LpDecorEffect, type LpDecorInteraction } from '../types/lpDecor';
import LpFreeformEditor from './LpFreeformEditor';

export default function LpDecorControls({ value, onChange }: { value: LpDecor; onChange: (d: LpDecor) => void }) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);

  const field: CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 8px', fontSize: 13, background: 'var(--bg-0)', color: 'var(--fg-0)' };
  const label: CSSProperties = { display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--fg-1)', margin: '12px 0 4px' };
  const rangeRow = (key: 'density' | 'speed' | 'size' | 'opacity' | 'intensity', min: number, max: number, step: number) => (
    <div>
      <label style={label}>{t(`admin.lpStudio.decor_${key}`)}: {value[key]}</label>
      <input type="range" min={min} max={max} step={step} value={value[key]} onChange={(e) => onChange({ ...value, [key]: Number(e.target.value) })} style={{ width: '100%' }} />
    </div>
  );

  return (
    <div>
      <label style={label}>{t('admin.lpStudio.decor_effect')}</label>
      <select
        value={value.effect}
        onChange={(e) => {
          const effect = e.target.value as LpDecorEffect;
          // 'custom' nu suportă repel/attract → resetăm interacția ca să nu rămână una invalidă pe DOM.
          const interaction = effect === 'custom' && (value.interaction === 'mouseReact' || value.interaction === 'mouseAttract') ? 'none' : value.interaction;
          onChange({ ...value, effect, interaction });
        }}
        style={field}
      >
        {LP_DECOR_EFFECTS.map((ef) => <option key={ef} value={ef}>{t(`admin.lpStudio.decorEffect_${ef}`)}</option>)}
      </select>

      {value.effect === 'custom' ? (
        <>
          <p style={{ fontSize: 11, color: 'var(--fg-1)', marginTop: 10 }}>{t('admin.lpStudio.decor_customHint')}</p>
          <button onClick={() => setEditing(true)} style={{ border: '1px solid var(--accent)', background: 'var(--accent)', color: 'var(--accent-contrast)', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginTop: 6 }}>{t('admin.lpStudio.decor_editElements', { count: (value.elements || []).length })}</button>
        </>
      ) : value.effect !== 'none' ? (
        <>
          <label style={label}>{t('admin.lpStudio.decor_interaction')}</label>
          <select value={value.interaction} onChange={(e) => onChange({ ...value, interaction: e.target.value as LpDecorInteraction })} style={field}>
            {LP_DECOR_INTERACTIONS.map((it) => <option key={it} value={it}>{t(`admin.lpStudio.decorInter_${it}`)}</option>)}
          </select>
          {value.interaction !== 'none' ? rangeRow('intensity', 0, 100, 1) : null}

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

          <p style={{ fontSize: 11, color: 'var(--fg-1)', marginTop: 12 }}>{t('admin.lpStudio.decor_previewHint')}</p>
        </>
      ) : null}
      {editing ? <LpFreeformEditor value={value} onChange={onChange} onClose={() => setEditing(false)} /> : null}
    </div>
  );
}
