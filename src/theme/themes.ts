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
