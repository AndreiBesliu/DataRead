/**
 * Manager de STRATURI de fundal decorativ pentru o pagină LP — listă de `LpDecor` suprapuse.
 * Fiecare strat folosește `LpDecorControls` existent; se pot adăuga/șterge/reordona (până la
 * LP_PAGE_DECORS_MAX). Ordinea = ordinea de stivuire (ultimul desenat deasupra; opacitatea le amestecă).
 */
import { type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { coerceToLpDecor, type LpDecor } from '../types/lpDecor';
import { LP_PAGE_DECORS_MAX } from '../types/landingPage';
import LpDecorControls from './LpDecorControls';

export default function LpDecorLayers({ value, onChange }: { value: LpDecor[]; onChange: (v: LpDecor[]) => void }) {
  const { t } = useTranslation();

  const update = (i: number, d: LpDecor) => onChange(value.map((x, idx) => (idx === i ? d : x)));
  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const add = () => {
    if (value.length >= LP_PAGE_DECORS_MAX) return;
    onChange([...value, coerceToLpDecor(null)]);
  };

  const layerBox: CSSProperties = { border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', marginTop: 8, background: 'var(--bg-0)' };
  const headRow: CSSProperties = { display: 'flex', alignItems: 'center', gap: 6 };
  const iconBtn: CSSProperties = { border: '1px solid var(--border)', background: 'var(--bg-1)', color: 'var(--fg-1)', borderRadius: 6, padding: '1px 8px', fontSize: 12, fontWeight: 700, cursor: 'pointer', lineHeight: 1.4 };

  return (
    <div>
      {value.length === 0 ? (
        <p style={{ fontSize: 11, color: 'var(--fg-1)', margin: '6px 0' }}>{t('admin.lpStudio.decor_layersEmpty')}</p>
      ) : null}

      {value.map((d, i) => (
        <div key={i} style={layerBox}>
          <div style={headRow}>
            <strong style={{ fontSize: 12 }}>{t('admin.lpStudio.decor_layer', { n: i + 1 })}</strong>
            <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
              <button type="button" style={{ ...iconBtn, opacity: i === 0 ? 0.4 : 1 }} disabled={i === 0} title={t('admin.lpStudio.decor_layerUp')} onClick={() => move(i, -1)}>▲</button>
              <button type="button" style={{ ...iconBtn, opacity: i === value.length - 1 ? 0.4 : 1 }} disabled={i === value.length - 1} title={t('admin.lpStudio.decor_layerDown')} onClick={() => move(i, 1)}>▼</button>
              <button type="button" style={{ ...iconBtn, color: '#c0392b' }} title={t('admin.lpStudio.decor_layerRemove')} onClick={() => remove(i)}>✕</button>
            </span>
          </div>
          <LpDecorControls value={d} onChange={(nd) => update(i, nd)} />
        </div>
      ))}

      {value.length < LP_PAGE_DECORS_MAX ? (
        <button
          type="button"
          onClick={add}
          style={{ marginTop: 10, border: '1px dashed var(--accent)', background: 'transparent', color: 'var(--accent)', borderRadius: 8, padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          {t('admin.lpStudio.decor_addLayer')}
        </button>
      ) : (
        <p style={{ fontSize: 11, color: 'var(--fg-1)', marginTop: 8 }}>{t('admin.lpStudio.decor_layersMax', { max: LP_PAGE_DECORS_MAX })}</p>
      )}
    </div>
  );
}
