/**
 * Teme pentru backend (/admin) — seturi de variabile CSS pe care le folosesc deja componentele
 * (--bg-0/1, --fg-0/1, --border, --accent…). Schimbarea temei = reskin instant, fără a atinge
 * componentele. Default-ul e o temă dark „digital/tech"; temele digitale primesc și un grid de
 * puncte discret pe fundal. Aplicat prin themeStyle() pe un wrapper al view-ului de admin.
 */
import type { CSSProperties } from 'react';

export interface AdminTheme {
  id: string;
  label: string;
  /** Variabilele CSS (fără prefixul `--`). */
  vars: {
    'bg-0': string;
    'bg-1': string;
    'fg-0': string;
    'fg-1': string;
    border: string;
    accent: string;
    'accent-dark': string;
    'accent-contrast': string;
  };
  /** Temă întunecată „digitală" (primește grid de puncte pe fundal). */
  digital?: boolean;
}

export const ADMIN_THEMES: AdminTheme[] = [
  {
    id: 'midnight',
    label: 'Midnight',
    digital: true,
    vars: { 'bg-0': '#0a0f1e', 'bg-1': '#121a30', 'fg-0': '#e8eefc', 'fg-1': '#8a9ac0', border: '#243154', accent: '#38bdf8', 'accent-dark': '#0ea5e9', 'accent-contrast': '#03121f' },
  },
  {
    id: 'carbon',
    label: 'Carbon',
    digital: true,
    vars: { 'bg-0': '#0c0c10', 'bg-1': '#17171f', 'fg-0': '#f1f1f5', 'fg-1': '#9a9ab0', border: '#2a2a36', accent: '#a855f7', 'accent-dark': '#9333ea', 'accent-contrast': '#150022' },
  },
  {
    id: 'matrix',
    label: 'Matrix',
    digital: true,
    vars: { 'bg-0': '#06120c', 'bg-1': '#0c1f15', 'fg-0': '#d6ffe6', 'fg-1': '#6fae87', border: '#16402a', accent: '#22c55e', 'accent-dark': '#16a34a', 'accent-contrast': '#02160a' },
  },
  {
    id: 'ocean',
    label: 'Ocean',
    digital: true,
    vars: { 'bg-0': '#071a2b', 'bg-1': '#0d2840', 'fg-0': '#e3f2ff', 'fg-1': '#86a8c4', border: '#1b4566', accent: '#2dd4bf', 'accent-dark': '#14b8a6', 'accent-contrast': '#022019' },
  },
  {
    id: 'light',
    label: 'Light',
    vars: { 'bg-0': '#f6f7f9', 'bg-1': '#ffffff', 'fg-0': '#16202c', 'fg-1': '#4b5563', border: '#e2e6eb', accent: '#2563eb', 'accent-dark': '#1d4ed8', 'accent-contrast': '#ffffff' },
  },
];

export const DEFAULT_ADMIN_THEME = 'midnight';

export function themeById(id: string): AdminTheme {
  return ADMIN_THEMES.find((th) => th.id === id) ?? ADMIN_THEMES.find((th) => th.id === DEFAULT_ADMIN_THEME)!;
}

/** Stilul de aplicat pe wrapperul de admin: variabilele temei + fundal (cu grid pentru cele digitale). */
export function themeStyle(id: string): CSSProperties {
  const th = themeById(id);
  const style: Record<string, string | number> = { minHeight: '100vh', color: th.vars['fg-0'] };
  for (const [k, v] of Object.entries(th.vars)) style[`--${k}`] = v;
  style.background = th.digital
    ? `radial-gradient(${th.vars.border} 1px, transparent 1px) 0 0 / 24px 24px, ${th.vars['bg-0']}`
    : th.vars['bg-0'];
  return style as CSSProperties;
}

// ---- Temă personalizată (configurator) -------------------------------------
// Andrei (13.06.2026): pentru admin se personalizează DOAR design-ul — culori,
// imagine de fundal, animații decor — NU layout-ul/structura. Tema custom se
// construiește pornind de la un preset și suprascriind doar aceste atribute.

export const CUSTOM_THEME_ID = 'custom';

export type ThemeAnimation = 'none' | 'pulse' | 'sheen' | 'drift';
export const THEME_ANIMATIONS: ThemeAnimation[] = ['none', 'pulse', 'sheen', 'drift'];

/** Cheile de culoare editabile, în ordinea afișării în editor. */
export const THEME_COLOR_KEYS: (keyof AdminTheme['vars'])[] = [
  'bg-0', 'bg-1', 'fg-0', 'fg-1', 'border', 'accent', 'accent-dark', 'accent-contrast',
];

export interface CustomTheme {
  schema: 1;
  /** Preset-ul de pornire (pentru reset / fallback la culori). */
  base: string;
  label: string;
  vars: AdminTheme['vars'];
  /** Grilă de puncte pe fundal. */
  digital: boolean;
  /** URL imagine de fundal (https; gol = fără). */
  bgImage: string;
  animation: ThemeAnimation;
}

const HEX6 = /^#[0-9a-fA-F]{6}$/;
// URL de imagine sigur pentru CSS url("…"): https, fără spații/ghilimele/paranteze.
const SAFE_IMG_URL = /^https:\/\/[^\s"')]+$/i;

export function defaultCustomTheme(baseId: string = DEFAULT_ADMIN_THEME): CustomTheme {
  const b = themeById(baseId);
  return { schema: 1, base: b.id, label: 'Tema mea', vars: { ...b.vars }, digital: !!b.digital, bgImage: '', animation: 'none' };
}

/** Normaliser UNIC — orice intrare stricată → temă validă, fără a arunca. */
export function coerceToCustomTheme(raw: unknown): CustomTheme {
  if (!raw || typeof raw !== 'object') return defaultCustomTheme();
  const o = raw as Record<string, unknown>;
  const base = typeof o.base === 'string' && ADMIN_THEMES.some((t) => t.id === o.base) ? o.base : DEFAULT_ADMIN_THEME;
  const bt = themeById(base);
  const rv = (o.vars && typeof o.vars === 'object' ? o.vars : {}) as Record<string, unknown>;
  const vars = { ...bt.vars };
  for (const k of THEME_COLOR_KEYS) {
    const v = rv[k];
    if (typeof v === 'string' && HEX6.test(v)) vars[k] = v;
  }
  const animation = THEME_ANIMATIONS.includes(o.animation as ThemeAnimation) ? (o.animation as ThemeAnimation) : 'none';
  const bgRaw = typeof o.bgImage === 'string' ? o.bgImage.trim() : '';
  const bgImage = SAFE_IMG_URL.test(bgRaw) ? bgRaw.slice(0, 500) : '';
  const label = typeof o.label === 'string' && o.label.trim() ? o.label.trim().slice(0, 40) : 'Tema mea';
  const digital = typeof o.digital === 'boolean' ? o.digital : !!bt.digital;
  return { schema: 1, base, label, vars, digital, bgImage, animation };
}

function hexToRgb(hex: string): [number, number, number] {
  if (!HEX6.test(hex)) return [0, 0, 0];
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Stilul wrapperului pentru o temă personalizată (variabile + fundal compus din straturi). */
interface BgLayers {
  backgroundColor: string;
  backgroundImage: string;
  backgroundSize: string;
  backgroundPosition: string;
  backgroundRepeat: string;
  backgroundAttachment: string;
}

/** Straturile de fundal compuse dintr-un CustomTheme (grilă + văl de lizibilitate + imagine +
 *  culoare). Sursă unică pentru customThemeStyle (CSSProperties) și customThemeCss (text). */
function customThemeBg(c: CustomTheme): BgLayers {
  const images: string[] = [];
  const sizes: string[] = [];
  const positions: string[] = [];
  const repeats: string[] = [];
  const attachments: string[] = [];

  if (c.digital) {
    images.push(`radial-gradient(${c.vars.border} 1px, transparent 1px)`);
    sizes.push('24px 24px'); positions.push('0 0'); repeats.push('repeat'); attachments.push('scroll');
  }
  if (c.bgImage) {
    const [r, g, b] = hexToRgb(c.vars['bg-0']);
    // Văl de lizibilitate: mai opac sus (unde stă header-ul/conținutul dens), mai transparent jos
    // ca imaginea să rămână vizibilă fără a sacrifica contrastul textului.
    images.push(`linear-gradient(rgba(${r},${g},${b},0.80), rgba(${r},${g},${b},0.52))`);
    sizes.push('auto'); positions.push('0 0'); repeats.push('repeat'); attachments.push('fixed');
    images.push(`url("${c.bgImage}")`);
    sizes.push('cover'); positions.push('center'); repeats.push('no-repeat'); attachments.push('fixed');
  }

  return {
    backgroundColor: c.vars['bg-0'],
    backgroundImage: images.join(', '),
    backgroundSize: sizes.join(', '),
    backgroundPosition: positions.join(', '),
    backgroundRepeat: repeats.join(', '),
    backgroundAttachment: attachments.join(', '),
  };
}

export function customThemeStyle(c: CustomTheme): CSSProperties {
  const style: Record<string, string | number> = { minHeight: '100vh', color: c.vars['fg-0'] };
  for (const k of THEME_COLOR_KEYS) style[`--${k}`] = c.vars[k];
  const bg = customThemeBg(c);
  style.backgroundColor = bg.backgroundColor;
  if (bg.backgroundImage) {
    style.backgroundImage = bg.backgroundImage;
    style.backgroundSize = bg.backgroundSize;
    style.backgroundPosition = bg.backgroundPosition;
    style.backgroundRepeat = bg.backgroundRepeat;
    style.backgroundAttachment = bg.backgroundAttachment;
  }
  return style as CSSProperties;
}

/** Design-ul ca text CSS — pentru pagina LP (preview iframe + SSR serveLp): variabilele pe :root,
 *  fundalul pe body. Aceeași compunere ca customThemeStyle. */
export function customThemeCss(c: CustomTheme): string {
  const vars = THEME_COLOR_KEYS.map((k) => `--${k}:${c.vars[k]}`).join(';');
  const bg = customThemeBg(c);
  const bgDecl = [`background-color:${bg.backgroundColor}`];
  if (bg.backgroundImage) {
    bgDecl.push(
      `background-image:${bg.backgroundImage}`,
      `background-size:${bg.backgroundSize}`,
      `background-position:${bg.backgroundPosition}`,
      `background-repeat:${bg.backgroundRepeat}`,
      `background-attachment:${bg.backgroundAttachment}`,
    );
  }
  // position:relative;z-index:0 → stacking context, ca decorul de fundal (canvas z-index:-1) să stea
  // în spatele conținutului, dar peste fundalul body-ului (fără a împacheta children-ii).
  return `:root{${vars}}\nbody{margin:0;min-height:100vh;position:relative;z-index:0;color:${c.vars['fg-0']};${bgDecl.join(';')}}`;
}

/** Clasa CSS pentru stratul decorativ animat (gol = fără animație). */
export function themeAnimClass(a: ThemeAnimation): string {
  return a === 'none' ? '' : `anim-${a}`;
}
