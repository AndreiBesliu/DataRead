/**
 * Ecranele de previzualizare ale LP Studio — preferință de workspace a operatorului: mai multe
 * dimensiuni afișate SIMULTAN în editor, toate redând LP-ul live. Persistate per-browser în localStorage
 * (prefix `dataread`, ca celelalte preferințe), globale pe toate LP-urile. Coerce unic + clamp; fără throw.
 */
export const LP_PREVIEW_SCREENS_KEY = 'dataread.lpPreviewScreens.v1';
export const LP_PREVIEW_SCREENS_MAX = 6;
export const LP_PV_W_MIN = 240;
export const LP_PV_W_MAX = 2560;
export const LP_PV_H_MIN = 320;
export const LP_PV_H_MAX = 2400;

export interface LpPreviewScreen {
  id: string; // pozițional (scr0, scr1…) — stabil per-încărcare; reatribuit de withIds
  label: string; // opțional; gol → se afișează „WxH"
  width: number;
  height: number;
}

export interface DevicePreset {
  key: string; // cheie i18n: admin.lpStudio.pv_${key}
  width: number;
  height: number;
}

export const DEVICE_PRESETS: DevicePreset[] = [
  { key: 'mobile', width: 390, height: 740 },
  { key: 'mobileL', width: 430, height: 860 },
  { key: 'tablet', width: 820, height: 1100 },
  { key: 'desktop', width: 1280, height: 760 },
];

const DEFAULTS: Array<{ width: number; height: number }> = [
  { width: 390, height: 740 },
  { width: 1280, height: 760 },
];

function clampInt(v: unknown, min: number, max: number, dflt: number): number {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : dflt;
}

/** Normalizează o listă de ecrane: clamp dimensiuni, plafon de număr, id-uri poziționale stabile. */
export function withIds(list: ReadonlyArray<{ label?: unknown; width?: unknown; height?: unknown }>): LpPreviewScreen[] {
  return list.slice(0, LP_PREVIEW_SCREENS_MAX).map((s, i) => ({
    id: `scr${i}`,
    label: typeof s.label === 'string' ? s.label.slice(0, 40) : '',
    width: clampInt(s.width, LP_PV_W_MIN, LP_PV_W_MAX, 390),
    height: clampInt(s.height, LP_PV_H_MIN, LP_PV_H_MAX, 740),
  }));
}

export function defaultScreens(): LpPreviewScreen[] {
  return withIds(DEFAULTS);
}

/** Unicul punct de intrare pentru date care pretind a fi ecrane de preview (din localStorage/teste). */
export function coerceToPreviewScreens(v: unknown): LpPreviewScreen[] {
  if (!Array.isArray(v)) return defaultScreens();
  const out = withIds(v.filter((x): x is Record<string, unknown> => typeof x === 'object' && x !== null));
  return out.length ? out : defaultScreens();
}

export function loadPreviewScreens(): LpPreviewScreen[] {
  try {
    const raw = localStorage.getItem(LP_PREVIEW_SCREENS_KEY);
    if (!raw) return defaultScreens();
    return coerceToPreviewScreens(JSON.parse(raw));
  } catch {
    return defaultScreens();
  }
}

export function savePreviewScreens(list: LpPreviewScreen[]): void {
  try {
    localStorage.setItem(LP_PREVIEW_SCREENS_KEY, JSON.stringify(list.map(({ label, width, height }) => ({ label, width, height }))));
  } catch {
    /* quota / mod privat — ignorăm */
  }
}
