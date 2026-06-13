// Suite headless: integritatea registrului de teme + fallback-ul.
import { ADMIN_THEMES, DEFAULT_ADMIN_THEME, themeById, themeStyle } from '../src/theme/themes';

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

if (failures) {
  console.error(`${failures} checks failed`);
  process.exit(1);
}
console.log('admin themes: all checks passed');
