/**
 * Editor de temă personalizată pentru /admin (modal). Modifică DOAR design-ul (culori, imagine de
 * fundal, animație de decor, grilă) — niciodată layout/structură. Modificările se aplică live
 * (wrapperul de admin folosește customThemeStyle(custom)), deci panoul e și preview. Controalele
 * sunt în ThemeControls (refolosite și de LP Studio). Persistarea o face useAdminTheme.
 */
import { type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { defaultCustomTheme, type CustomTheme } from './themes';
import ThemeControls from './ThemeControls';

export default function ThemeEditor({
  value,
  onChange,
  onClose,
}: {
  value: CustomTheme;
  onChange: (c: CustomTheme) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const reset = () => onChange({ ...defaultCustomTheme(value.base), label: value.label });

  const overlay: CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 16px', zIndex: 50, overflowY: 'auto' };
  const panel: CSSProperties = { width: '100%', maxWidth: 460, background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, color: 'var(--fg-0)', boxShadow: '0 18px 50px rgba(0,0,0,0.5)' };
  const btn: CSSProperties = { border: '1px solid var(--border)', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', background: 'var(--bg-0)', color: 'var(--fg-0)' };
  const btnPrimary: CSSProperties = { ...btn, background: 'var(--accent)', color: 'var(--accent-contrast)', border: '1px solid var(--accent)' };

  return (
    <div style={overlay} onClick={onClose}>
      <div style={panel} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h2 style={{ fontSize: 17, margin: 0 }}>🎨 {t('admin.themeEditor.title')}</h2>
          <button onClick={onClose} aria-label={t('admin.themeEditor.close')} style={{ marginLeft: 'auto', ...btn, padding: '4px 10px' }}>✕</button>
        </div>
        <p style={{ fontSize: 12, color: 'var(--fg-1)', margin: '6px 0 0' }}>{t('admin.themeEditor.hint')}</p>

        <ThemeControls value={value} onChange={onChange} />

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button onClick={reset} style={btn}>{t('admin.themeEditor.reset')}</button>
          <button onClick={onClose} style={{ ...btnPrimary, marginLeft: 'auto' }}>{t('admin.themeEditor.done')}</button>
        </div>
      </div>
    </div>
  );
}
