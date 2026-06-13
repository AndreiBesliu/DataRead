/**
 * Editor de temă personalizată pentru /admin. Modifică DOAR design-ul (culori, imagine de fundal,
 * animație de decor, grilă) — niciodată layout/structură. Modificările se aplică live (wrapperul de
 * admin folosește customThemeStyle(custom)), deci panoul e și preview. Persistarea o face useAdminTheme.
 */
import { type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ADMIN_THEMES,
  THEME_ANIMATIONS,
  THEME_COLOR_KEYS,
  defaultCustomTheme,
  themeById,
  type CustomTheme,
  type ThemeAnimation,
} from './themes';

const COLOR_LABEL_KEY: Record<string, string> = {
  'bg-0': 'admin.themeEditor.cBg0',
  'bg-1': 'admin.themeEditor.cBg1',
  'fg-0': 'admin.themeEditor.cFg0',
  'fg-1': 'admin.themeEditor.cFg1',
  border: 'admin.themeEditor.cBorder',
  accent: 'admin.themeEditor.cAccent',
  'accent-dark': 'admin.themeEditor.cAccentDark',
  'accent-contrast': 'admin.themeEditor.cAccentContrast',
};

const ANIM_LABEL_KEY: Record<ThemeAnimation, string> = {
  none: 'admin.themeEditor.animNone',
  pulse: 'admin.themeEditor.animPulse',
  sheen: 'admin.themeEditor.animSheen',
  drift: 'admin.themeEditor.animDrift',
};

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

  const setVar = (k: keyof CustomTheme['vars'], v: string) =>
    onChange({ ...value, vars: { ...value.vars, [k]: v } });
  const loadPreset = (id: string) => {
    const p = themeById(id);
    onChange({ ...value, base: p.id, vars: { ...p.vars }, digital: !!p.digital });
  };
  const reset = () => onChange({ ...defaultCustomTheme(value.base), label: value.label });

  const overlay: CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 16px', zIndex: 50, overflowY: 'auto' };
  const panel: CSSProperties = { width: '100%', maxWidth: 460, background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, color: 'var(--fg-0)', boxShadow: '0 18px 50px rgba(0,0,0,0.5)' };
  const label: CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--fg-1)', marginBottom: 6, marginTop: 14 };
  const field: CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1px solid var(--border)', borderRadius: 6, padding: '7px 9px', fontSize: 13, background: 'var(--bg-0)', color: 'var(--fg-0)' };
  const colorRow: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '5px 0', fontSize: 13 };
  const swatch: CSSProperties = { width: 44, height: 28, padding: 0, border: '1px solid var(--border)', borderRadius: 6, background: 'transparent', cursor: 'pointer' };
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

        <label style={label} htmlFor="te-name">{t('admin.themeEditor.name')}</label>
        <input id="te-name" type="text" maxLength={40} value={value.label} onChange={(e) => onChange({ ...value, label: e.target.value })} style={field} />

        <label style={label} htmlFor="te-base">{t('admin.themeEditor.startFrom')}</label>
        <select id="te-base" value={value.base} onChange={(e) => loadPreset(e.target.value)} style={field}>
          {ADMIN_THEMES.map((th) => <option key={th.id} value={th.id}>{th.label}</option>)}
        </select>

        <div style={label}>{t('admin.themeEditor.colors')}</div>
        <div>
          {THEME_COLOR_KEYS.map((k) => (
            <div key={k} style={colorRow}>
              <span>{t(COLOR_LABEL_KEY[k])}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <code style={{ fontSize: 12, color: 'var(--fg-1)' }}>{value.vars[k]}</code>
                <input type="color" value={value.vars[k]} onChange={(e) => setVar(k, e.target.value)} style={swatch} aria-label={t(COLOR_LABEL_KEY[k])} />
              </span>
            </div>
          ))}
        </div>

        <label style={label} htmlFor="te-bg">{t('admin.themeEditor.bgImage')}</label>
        <input id="te-bg" type="url" inputMode="url" placeholder="https://…" value={value.bgImage} onChange={(e) => onChange({ ...value, bgImage: e.target.value })} style={field} />
        <p style={{ fontSize: 11, color: 'var(--fg-1)', margin: '4px 0 0' }}>{t('admin.themeEditor.bgImageHint')}</p>

        <label style={{ ...colorRow, marginTop: 14, cursor: 'pointer' }}>
          <span>{t('admin.themeEditor.grid')}</span>
          <input type="checkbox" checked={value.digital} onChange={(e) => onChange({ ...value, digital: e.target.checked })} />
        </label>

        <label style={label} htmlFor="te-anim">{t('admin.themeEditor.animation')}</label>
        <select id="te-anim" value={value.animation} onChange={(e) => onChange({ ...value, animation: e.target.value as ThemeAnimation })} style={field}>
          {THEME_ANIMATIONS.map((a) => <option key={a} value={a}>{t(ANIM_LABEL_KEY[a])}</option>)}
        </select>

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button onClick={reset} style={btn}>{t('admin.themeEditor.reset')}</button>
          <button onClick={onClose} style={{ ...btnPrimary, marginLeft: 'auto' }}>{t('admin.themeEditor.done')}</button>
        </div>
      </div>
    </div>
  );
}
