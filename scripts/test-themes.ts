// Suite headless: integritatea registrului de teme + fallback-ul + tema personalizată.
import {
  ADMIN_THEMES,
  DEFAULT_ADMIN_THEME,
  THEME_COLOR_KEYS,
  coerceToCustomTheme,
  customThemeCss,
  customThemeStyle,
  defaultCustomTheme,
  themeAnimClass,
  themeById,
  themeStyle,
} from '../src/theme/themes';

let failures = 0;
function check(name: string, ok: boolean): void {
  if (ok) console.log(`  ✓ ${name}`);
  else {
    failures++;
    console.error(`  ✗ ${name}`);
  }
}

check('cel puțin 3 teme', ADMIN_THEMES.length >= 3);
check('id-uri unice', new Set(ADMIN_THEMES.map((t) => t.id)).size === ADMIN_THEMES.length);
check('tema default există', ADMIN_THEMES.some((t) => t.id === DEFAULT_ADMIN_THEME));
check('toate temele au variabilele complete', ADMIN_THEMES.every((t) => ['bg-0', 'bg-1', 'fg-0', 'fg-1', 'border', 'accent', 'accent-dark', 'accent-contrast'].every((k) => typeof (t.vars as Record<string, string>)[k] === 'string')));
check('toate culorile sunt hex valide', ADMIN_THEMES.every((t) => Object.values(t.vars).every((v) => /^#[0-9a-fA-F]{6}$/.test(v))));
check('themeById(necunoscut) → default', themeById('nope').id === DEFAULT_ADMIN_THEME);
check('themeStyle pune variabilele + fundal', (() => {
  const s = themeStyle('midnight') as Record<string, string>;
  return s['--bg-0'] === '#0a0f1e' && typeof s.background === 'string' && s.background.includes('#0a0f1e');
})());
check('themeStyle light = fără grid', (() => {
  const s = themeStyle('light') as Record<string, string>;
  return s.background === '#f6f7f9';
})());

// ---- Temă personalizată (coerce + style) ----
const HEX = /^#[0-9a-fA-F]{6}$/;

check('defaultCustomTheme = schema 1 + culori valide', (() => {
  const d = defaultCustomTheme();
  return d.schema === 1 && d.base === DEFAULT_ADMIN_THEME && THEME_COLOR_KEYS.every((k) => HEX.test(d.vars[k]));
})());
check('coerce(null) → default', coerceToCustomTheme(null).base === DEFAULT_ADMIN_THEME);
check('coerce(gunoi) nu aruncă → culori valide', (() => {
  const c = coerceToCustomTheme({ vars: { 'bg-0': 'nu-e-hex', accent: 123 }, base: 'inexistent', animation: 'turbo', bgImage: 42 });
  return THEME_COLOR_KEYS.every((k) => HEX.test(c.vars[k])) && c.animation === 'none' && c.bgImage === '' && c.base === DEFAULT_ADMIN_THEME;
})());
check('coerce păstrează override valid de culoare', coerceToCustomTheme({ vars: { accent: '#abcdef' } }).vars.accent === '#abcdef');
check('coerce respinge bgImage nesigur (javascript:)', coerceToCustomTheme({ bgImage: 'javascript:alert(1)' }).bgImage === '');
check('coerce respinge bgImage cu ghilimele (CSS break-out)', coerceToCustomTheme({ bgImage: 'https://x/a") url(evil' }).bgImage === '');
check('coerce acceptă https valid', coerceToCustomTheme({ bgImage: 'https://ex.com/bg.jpg' }).bgImage === 'https://ex.com/bg.jpg');
check('coerce acceptă animație validă', coerceToCustomTheme({ animation: 'drift' }).animation === 'drift');
check('customThemeStyle pune variabilele + backgroundColor', (() => {
  const s = customThemeStyle(coerceToCustomTheme({ vars: { 'bg-0': '#101010' } })) as Record<string, string>;
  return s['--bg-0'] === '#101010' && s.backgroundColor === '#101010';
})());
check('customThemeStyle cu imagine → straturi de fundal', (() => {
  const s = customThemeStyle(coerceToCustomTheme({ bgImage: 'https://ex.com/b.png', digital: true })) as Record<string, string>;
  return typeof s.backgroundImage === 'string' && s.backgroundImage.includes('url("https://ex.com/b.png")') && s.backgroundImage.includes('radial-gradient');
})());
check('themeAnimClass: none → gol, restul → anim-*', themeAnimClass('none') === '' && themeAnimClass('drift') === 'anim-drift');
check('customThemeCss: variabile pe :root + fundal pe body (pt. pagina LP)', (() => {
  const css = customThemeCss(coerceToCustomTheme({ vars: { accent: '#a855f7' }, digital: true }));
  return css.includes('--accent:#a855f7') && css.includes(':root{') && css.includes('body{') && css.includes('background-color:');
})());
check('customThemeCss cu imagine → url + radial-gradient (grilă)', (() => {
  const css = customThemeCss(coerceToCustomTheme({ bgImage: 'https://ex.com/b.png', digital: true }));
  return css.includes('url("https://ex.com/b.png")') && css.includes('radial-gradient');
})());

if (failures) {
  console.error(`${failures} checks failed`);
  process.exit(1);
}
console.log('admin themes: all checks passed');
