/**
 * Controalele de design (culori, imagine de fundal, animație de decor, grilă) pentru un CustomTheme.
 * Refolosite în două locuri: ThemeEditor (tema /admin) și LP Studio (design-ul unei Landing Page).
 * Doar DESIGN — niciodată layout/structură.
 */
import { type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { ADMIN_THEMES, THEME_ANIMATIONS, THEME_COLOR_KEYS, themeById, type CustomTheme, type ThemeAnimation } from './themes';

export const COLOR_LABEL_KEY: Record<string, string> = {
  'bg-0': 'admin.themeEditor.cBg0',
  'bg-1': 'admin.themeEditor.cBg1',
  'fg-0': 'admin.themeEditor.cFg0',
  'fg-1': 'admin.themeEditor.cFg1',
  border: 'admin.themeEditor.cBorder',
  accent: 'admin.themeEditor.cAccent',
  'accent-dark': 'admin.themeEditor.cAccentDark',
  'accent-contrast': 'admin.themeEditor.cAccentContrast',
};

export const ANIM_LABEL_KEY: Record<ThemeAnimation, string> = {
  none: 'admin.themeEditor.animNone',
  pulse: 'admin.themeEditor.animPulse',
  sheen: 'admin.themeEditor.animSheen',
  drift: 'admin.themeEditor.animDrift',
};

const label: CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--fg-1)', marginBottom: 6, marginTop: 14 };
const field: CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1px solid var(--border)', borderRadius: 6, padding: '7px 9px', fontSize: 13, background: 'var(--bg-0)', color: 'var(--fg-0)' };
const colorRow: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '5px 0', fontSize: 13 };
const swatch: CSSProperties = { width: 44, height: 28, padding: 0, border: '1px solid var(--border)', borderRadius: 6, background: 'transparent', cursor: 'pointer' };

export default function ThemeControls({
  value,
  onChange,
  withName = true,
  withAnimation = true,
}: {
  value: CustomTheme;
  onChange: (c: CustomTheme) => void;
  withName?: boolean;
  withAnimation?: boolean;
}) {
  const { t } = useTranslation();
  const setVar = (k: keyof CustomTheme['vars'], v: string) => onChange({ ...value, vars: { ...value.vars, [k]: v } });
  const loadPreset = (id: string) => {
    const p = themeById(id);
    onChange({ ...value, base: p.id, vars: { ...p.vars }, digital: !!p.digital });
  };

  return (
    <>
      {withName ? (
        <>
          <label style={label} htmlFor="tc-name">{t('admin.themeEditor.name')}</label>
          <input id="tc-name" type="text" maxLength={40} value={value.label} onChange={(e) => onChange({ ...value, label: e.target.value })} style={field} />
        </>
      ) : null}

      <label style={label} htmlFor="tc-base">{t('admin.themeEditor.startFrom')}</label>
      <select id="tc-base" value={value.base} onChange={(e) => loadPreset(e.target.value)} style={field}>
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

      <label style={label} htmlFor="tc-bg">{t('admin.themeEditor.bgImage')}</label>
      <input id="tc-bg" type="url" inputMode="url" placeholder="https://…" value={value.bgImage} onChange={(e) => onChange({ ...value, bgImage: e.target.value })} style={field} />
      <p style={{ fontSize: 11, color: 'var(--fg-1)', margin: '4px 0 0' }}>{t('admin.themeEditor.bgImageHint')}</p>

      <label style={{ ...colorRow, marginTop: 14, cursor: 'pointer' }}>
        <span>{t('admin.themeEditor.grid')}</span>
        <input type="checkbox" checked={value.digital} onChange={(e) => onChange({ ...value, digital: e.target.checked })} />
      </label>

      {withAnimation ? (
        <>
          <label style={label} htmlFor="tc-anim">{t('admin.themeEditor.animation')}</label>
          <select id="tc-anim" value={value.animation} onChange={(e) => onChange({ ...value, animation: e.target.value as ThemeAnimation })} style={field}>
            {THEME_ANIMATIONS.map((a) => <option key={a} value={a}>{t(ANIM_LABEL_KEY[a])}</option>)}
          </select>
        </>
      ) : null}
    </>
  );
}
