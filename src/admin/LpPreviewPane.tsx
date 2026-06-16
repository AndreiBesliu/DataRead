/**
 * Panoul de previzualizare al LP — MAI MULTE ecrane de dimensiuni diferite afișate SIMULTAN, toate
 * redând același LP live (același srcDoc). Setul de ecrane e o preferință de workspace, persistată
 * per-browser (localStorage, vezi lpPreviewScreens.ts) → la redeschidere revin. Operatorul adaugă
 * presete de dispozitiv sau dimensiuni custom (W×H), șterge sau resetează.
 */
import { useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DEVICE_PRESETS,
  LP_PREVIEW_SCREENS_MAX,
  LP_PV_H_MAX,
  LP_PV_H_MIN,
  LP_PV_W_MAX,
  LP_PV_W_MIN,
  defaultScreens,
  loadPreviewScreens,
  savePreviewScreens,
  withIds,
  type LpPreviewScreen,
} from '../types/lpPreviewScreens';

export default function LpPreviewPane({ srcDoc }: { srcDoc: string }) {
  const { t } = useTranslation();
  const [screens, setScreensState] = useState<LpPreviewScreen[]>(() => loadPreviewScreens());
  const [adding, setAdding] = useState(false);
  const [cw, setCw] = useState(900);
  const [ch, setCh] = useState(700);

  const persist = (next: LpPreviewScreen[]) => {
    const ids = withIds(next);
    setScreensState(ids);
    savePreviewScreens(ids);
  };

  const full = screens.length >= LP_PREVIEW_SCREENS_MAX;
  const addPreset = (p: { width: number; height: number }) => { if (!full) persist([...screens, { id: '', label: '', width: p.width, height: p.height }]); };
  const addCustom = () => { if (!full) persist([...screens, { id: '', label: '', width: cw, height: ch }]); setAdding(false); };
  const removeAt = (i: number) => persist(screens.filter((_, idx) => idx !== i));

  const btn: CSSProperties = { border: '1px solid var(--border)', background: 'var(--bg-0)', color: 'var(--fg-1)', borderRadius: 7, padding: '4px 9px', fontSize: 12, fontWeight: 600, cursor: 'pointer', lineHeight: 1.3 };
  const numField: CSSProperties = { width: 70, border: '1px solid var(--border)', borderRadius: 6, padding: '4px 6px', fontSize: 12, background: 'var(--bg-0)', color: 'var(--fg-0)' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0 10px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-1)' }}>{t('admin.lpStudio.preview')}</span>
        <span style={{ fontSize: 11, color: 'var(--fg-1)' }}>({screens.length})</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {DEVICE_PRESETS.map((p) => (
            <button key={p.key} type="button" style={{ ...btn, opacity: full ? 0.4 : 1 }} disabled={full} title={`${p.width}×${p.height}`} onClick={() => addPreset(p)}>
              + {t(`admin.lpStudio.pv_${p.key}`)}
            </button>
          ))}
          <button type="button" style={{ ...btn, opacity: full ? 0.4 : 1 }} disabled={full} onClick={() => setAdding((v) => !v)}>{t('admin.lpStudio.pv_custom')}</button>
          <button type="button" style={btn} onClick={() => persist(defaultScreens())}>{t('admin.lpStudio.pv_reset')}</button>
        </div>
      </div>

      {adding ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-1)' }}>
          <label style={{ fontSize: 12, color: 'var(--fg-1)', display: 'flex', alignItems: 'center', gap: 6 }}>
            {t('admin.lpStudio.pv_width')}
            <input type="number" min={LP_PV_W_MIN} max={LP_PV_W_MAX} value={cw} onChange={(e) => setCw(Number(e.target.value) || 0)} style={numField} />
          </label>
          <label style={{ fontSize: 12, color: 'var(--fg-1)', display: 'flex', alignItems: 'center', gap: 6 }}>
            {t('admin.lpStudio.pv_height')}
            <input type="number" min={LP_PV_H_MIN} max={LP_PV_H_MAX} value={ch} onChange={(e) => setCh(Number(e.target.value) || 0)} style={numField} />
          </label>
          <button type="button" style={{ ...btn, background: 'var(--accent)', color: 'var(--accent-contrast)', border: '1px solid var(--accent)' }} onClick={addCustom}>{t('admin.lpStudio.pv_addScreen')}</button>
        </div>
      ) : null}

      {/* Rând orizontal scrollabil cu toate ecranele live, fiecare la dimensiunea proprie. */}
      <div className="lp-preview-surface" style={{ display: 'flex', gap: 16, alignItems: 'flex-start', overflow: 'auto', borderRadius: 10, padding: 14, maxHeight: 820, resize: 'vertical' }}>
        {screens.length === 0 ? (
          <p style={{ fontSize: 12, color: 'var(--fg-1)', margin: 'auto' }}>{t('admin.lpStudio.pv_empty')}</p>
        ) : (
          screens.map((s, i) => (
            <div key={s.id} style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-1)' }}>{s.label || `${s.width}×${s.height}`}</span>
                <button type="button" title={t('admin.lpStudio.pv_remove')} onClick={() => removeAt(i)} style={{ marginLeft: 'auto', border: '1px solid var(--border)', background: 'var(--bg-0)', color: '#c0392b', borderRadius: 6, padding: '0 7px', fontSize: 12, fontWeight: 700, cursor: 'pointer', lineHeight: 1.5 }}>✕</button>
              </div>
              <iframe
                title={`preview-${s.id}`}
                srcDoc={srcDoc}
                sandbox="allow-forms allow-popups allow-scripts"
                referrerPolicy="no-referrer"
                style={{ width: s.width, height: s.height, border: 'none', borderRadius: 10, background: '#fff', boxShadow: '0 8px 30px rgba(0,0,0,0.4)' }}
              />
            </div>
          ))
        )}
      </div>
      <p style={{ fontSize: 11, color: 'var(--fg-1)', marginTop: 8 }}>{t('admin.lpStudio.pv_multiHint')}</p>
    </div>
  );
}
