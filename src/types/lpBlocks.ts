/**
 * Modelul de blocuri pentru builder-ul vizual al Landing Pages. O LP în mod „visual" stochează un
 * array de blocuri; `compileBlocks` le transformă în ACELAȘI `html` self-contained pe care serveLp
 * îl servește deja — deci servirea + regulile rămân neatinse. Blocurile folosesc variabilele de temă
 * (var(--accent) etc.), injectate de design. Compilarea e PURĂ (testabilă headless).
 */
import type { LpFormConfig } from './landingPage';
import { coerceToLpDecor, compileDecor, defaultDecor } from './lpDecor';

export const LP_BLOCK_TYPES = ['hero', 'heading', 'text', 'image', 'button', 'features', 'testimonial', 'faq', 'form', 'spacer', 'decor'] as const;
export type LpBlockType = (typeof LP_BLOCK_TYPES)[number];

export interface LpBlock {
  id: string;
  type: LpBlockType;
  props: Record<string, unknown>;
}

const TXT = 4000;

function str(v: unknown, max = 400): string {
  return typeof v === 'string' ? v.slice(0, max) : '';
}
function arr(v: unknown): Record<string, unknown>[] {
  return Array.isArray(v) ? v.filter((x) => x && typeof x === 'object').slice(0, 20).map((x) => x as Record<string, unknown>) : [];
}

/** Proprietățile implicite la adăugarea unui bloc nou (paleta builder-ului). */
export function defaultBlockProps(type: LpBlockType): Record<string, unknown> {
  switch (type) {
    case 'hero':
      return { heading: 'Titlu puternic aici', subheading: 'Un subtitlu scurt care explică oferta.', ctaText: 'Acțiune', ctaHref: '#', align: 'center' };
    case 'heading':
      return { text: 'Titlu de secțiune', level: 'h2', align: 'left' };
    case 'text':
      return { text: 'Scrie aici un paragraf descriptiv.', align: 'left' };
    case 'image':
      return { url: '', alt: '', width: 800 };
    case 'button':
      return { text: 'Apasă aici', href: '#', align: 'center' };
    case 'features':
      return { columns: 3, items: [{ title: 'Beneficiu 1', body: 'Descriere scurtă.' }, { title: 'Beneficiu 2', body: 'Descriere scurtă.' }, { title: 'Beneficiu 3', body: 'Descriere scurtă.' }] };
    case 'testimonial':
      return { quote: 'Recomand cu încredere — rezultate excelente.', author: 'Client mulțumit' };
    case 'faq':
      return { items: [{ q: 'Întrebare frecventă?', a: 'Răspuns clar.' }] };
    case 'form':
      return { heading: 'Lasă-ne datele tale' };
    case 'spacer':
      return { size: 48 };
    case 'decor':
      return { decor: { ...defaultDecor(), effect: 'dots', interaction: 'mouseReact', density: 50 }, heading: '', subheading: '', ctaText: '', ctaHref: '#', minHeight: 360 };
    default:
      return {};
  }
}

export function coerceToLpBlock(raw: unknown, index = 0): LpBlock | null {
  if (!raw || typeof raw !== 'object') return null;
  const b = raw as Record<string, unknown>;
  if (!LP_BLOCK_TYPES.includes(b.type as LpBlockType)) return null;
  const type = b.type as LpBlockType;
  const rawProps = b.props && typeof b.props === 'object' ? (b.props as Record<string, unknown>) : {};
  // Normaliser unic pe TOATE căile de încărcare (regula CLAUDE.md): decorul din props (fundal de bloc
  // sau decorul blocului 'decor') e hardening-uit la load, nu doar la compile.
  const props: Record<string, unknown> = { ...rawProps };
  if ('bgDecor' in props) props.bgDecor = coerceToLpDecor(props.bgDecor);
  if (type === 'decor' && 'decor' in props) props.decor = coerceToLpDecor(props.decor);
  const id = typeof b.id === 'string' && b.id ? b.id.slice(0, 40) : `b${index}`;
  return { id, type, props };
}

export function coerceBlocks(raw: unknown): LpBlock[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((b, i) => coerceToLpBlock(b, i)).filter((b): b is LpBlock => b !== null).slice(0, 60);
}

const esc = (v: unknown): string =>
  String(v == null ? '' : v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
const escAttr = (v: unknown): string => esc(v);
const align = (v: unknown): string => (v === 'center' ? 'center' : v === 'right' ? 'right' : 'left');
const nbr = (v: unknown, d: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const para = (text: string): string => esc(text).replace(/\n{2,}/g, '</p><p>').replace(/\n/g, '<br>');
const SAFE_URL = /^https:\/\/[^\s"')]+$/i;
const safeHref = (v: unknown): string => {
  const s = str(v, 500);
  return s === '#' || /^https?:\/\//i.test(s) || /^\/[^/]/.test(s) || /^mailto:/i.test(s) || /^tel:/i.test(s) ? s : '#';
};

const WRAP = 'max-width:1080px;margin:0 auto;padding:0 24px';

function compileBlock(block: LpBlock, ctx: { form: LpFormConfig }): string {
  const p = block.props || {};
  switch (block.type) {
    case 'hero': {
      const a = align(p.align);
      const cta = str(p.ctaText)
        ? `<a data-cta href="${escAttr(safeHref(p.ctaHref))}" style="display:inline-block;margin-top:24px;background:var(--accent);color:var(--accent-contrast);padding:15px 32px;border-radius:10px;font-weight:700;font-size:16px;text-decoration:none">${esc(p.ctaText)}</a>`
        : '';
      return `<section style="padding:80px 24px;text-align:${a}"><div style="max-width:760px;margin:0 auto"><h1 style="font-size:clamp(32px,5vw,52px);line-height:1.1;margin:0 0 16px;color:var(--fg-0)">${esc(str(p.heading, TXT))}</h1><p style="font-size:clamp(16px,2.4vw,20px);color:var(--fg-1);margin:0">${esc(str(p.subheading, TXT))}</p>${cta}</div></section>`;
    }
    case 'heading': {
      const tag = p.level === 'h3' ? 'h3' : 'h2';
      const sz = tag === 'h3' ? '22px' : '30px';
      return `<section style="${WRAP};padding:28px 24px 8px"><${tag} style="font-size:${sz};color:var(--fg-0);text-align:${align(p.align)};margin:0">${esc(str(p.text, TXT))}</${tag}></section>`;
    }
    case 'text':
      return `<section style="${WRAP};padding:12px 24px"><div style="font-size:16px;line-height:1.7;color:var(--fg-1);text-align:${align(p.align)};max-width:760px;margin:0 auto"><p>${para(str(p.text, TXT))}</p></div></section>`;
    case 'image': {
      const url = str(p.url, 600);
      if (!SAFE_URL.test(url)) return '';
      const w = Math.min(Math.max(nbr(p.width, 800), 80), 1600);
      return `<section style="${WRAP};padding:20px 24px;text-align:center"><img src="${escAttr(url)}" alt="${escAttr(str(p.alt, 200))}" loading="lazy" style="max-width:min(100%,${w}px);height:auto;border-radius:12px"></section>`;
    }
    case 'button':
      return `<section style="${WRAP};padding:16px 24px;text-align:${align(p.align)}"><a data-cta href="${escAttr(safeHref(p.href))}" style="display:inline-block;background:var(--accent);color:var(--accent-contrast);padding:14px 30px;border-radius:10px;font-weight:700;font-size:16px;text-decoration:none">${esc(str(p.text))}</a></section>`;
    case 'features': {
      const cols = Math.min(Math.max(nbr(p.columns, 3), 1), 4);
      const items = arr(p.items)
        .map((it) => `<div style="background:var(--bg-1);border:1px solid var(--border);border-radius:12px;padding:22px"><h3 style="margin:0 0 8px;font-size:18px;color:var(--fg-0)">${esc(str(it.title))}</h3><p style="margin:0;font-size:15px;line-height:1.6;color:var(--fg-1)">${esc(str(it.body, TXT))}</p></div>`)
        .join('');
      return `<section style="${WRAP};padding:32px 24px"><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;max-width:${cols * 280}px;margin:0 auto">${items}</div></section>`;
    }
    case 'testimonial':
      return `<section style="${WRAP};padding:36px 24px"><figure style="max-width:680px;margin:0 auto;text-align:center"><blockquote style="font-size:22px;line-height:1.5;color:var(--fg-0);margin:0 0 14px;font-style:italic">“${esc(str(p.quote, TXT))}”</blockquote><figcaption style="color:var(--accent);font-weight:700">${esc(str(p.author))}</figcaption></figure></section>`;
    case 'faq': {
      const items = arr(p.items)
        .map((it) => `<details style="background:var(--bg-1);border:1px solid var(--border);border-radius:10px;padding:14px 18px;margin-bottom:10px"><summary style="cursor:pointer;font-weight:700;color:var(--fg-0)">${esc(str(it.q))}</summary><p style="margin:10px 0 0;color:var(--fg-1);line-height:1.6">${esc(str(it.a, TXT))}</p></details>`)
        .join('');
      return `<section style="max-width:760px;margin:0 auto;padding:32px 24px">${items}</section>`;
    }
    case 'form': {
      // Randăm formularul DOAR dacă e activat — altfel ar ajunge public un formular fără handler
      // (serveLp injectează submit-ul doar când hasForm). LpEditor activează formularul când există
      // un bloc 'form', deci aici e și o gardă defensivă.
      if (!ctx.form || !ctx.form.enabled) return '';
      const fields = (ctx.form && Array.isArray(ctx.form.fields) ? ctx.form.fields : [])
        .map((f) => {
          const req = f.required ? ' required' : '';
          const common = `name="${escAttr(f.name)}" placeholder="${escAttr(f.label || f.name)}"${req} style="width:100%;box-sizing:border-box;padding:12px 14px;margin:0 0 12px;border:1px solid var(--border);border-radius:8px;background:var(--bg-0);color:var(--fg-0);font-size:15px"`;
          if (f.type === 'textarea') return `<textarea ${common} rows="4"></textarea>`;
          if (f.type === 'checkbox') return `<label style="display:flex;gap:8px;align-items:center;margin:0 0 12px;color:var(--fg-1)"><input type="checkbox" name="${escAttr(f.name)}"${req}> ${esc(f.label || f.name)}</label>`;
          if (f.type === 'select') {
            const opts = (f.options || []).map((o) => `<option value="${escAttr(o)}">${esc(o)}</option>`).join('');
            return `<select ${common}><option value="">${esc(f.label || f.name)}</option>${opts}</select>`;
          }
          const t = f.type === 'email' ? 'email' : f.type === 'tel' ? 'tel' : 'text';
          return `<input type="${t}" ${common}>`;
        })
        .join('');
      const heading = str(p.heading) ? `<h2 style="text-align:center;color:var(--fg-0);margin:0 0 18px;font-size:26px">${esc(p.heading)}</h2>` : '';
      const submit = esc((ctx.form && ctx.form.submitLabel) || 'Trimite');
      return `<section style="max-width:520px;margin:0 auto;padding:36px 24px">${heading}<form data-lp-form>${fields}<button type="submit" style="width:100%;background:var(--accent);color:var(--accent-contrast);border:none;padding:14px;border-radius:10px;font-weight:700;font-size:16px;cursor:pointer">${submit}</button></form></section>`;
    }
    case 'spacer':
      return `<div style="height:${Math.min(Math.max(nbr(p.size, 48), 0), 400)}px"></div>`;
    case 'decor': {
      const decor = coerceToLpDecor(p.decor);
      const mh = Math.min(Math.max(nbr(p.minHeight, 360), 80), 1000);
      const decorHtml = compileDecor(decor, `bk-${block.id}`, 'block');
      const heading = str(p.heading) ? `<h2 style="font-size:clamp(28px,4vw,44px);margin:0 0 12px;color:var(--fg-0)">${esc(str(p.heading, TXT))}</h2>` : '';
      const sub = str(p.subheading) ? `<p style="font-size:18px;color:var(--fg-1);margin:0">${esc(str(p.subheading, TXT))}</p>` : '';
      const cta = str(p.ctaText) ? `<a data-cta href="${escAttr(safeHref(p.ctaHref))}" style="display:inline-block;margin-top:22px;background:var(--accent);color:var(--accent-contrast);padding:14px 30px;border-radius:10px;font-weight:700;text-decoration:none">${esc(p.ctaText)}</a>` : '';
      const overlay = heading || sub || cta ? `<div style="position:relative;z-index:1;text-align:center;max-width:760px;margin:0 auto;padding:0 24px">${heading}${sub}${cta}</div>` : '';
      return `<section style="position:relative;min-height:${mh}px;display:flex;align-items:center;justify-content:center;padding:56px 0;overflow:hidden">${decorHtml}${overlay}</section>`;
    }
    default:
      return '';
  }
}

/** Blocuri → pagina HTML self-contained (corpul). PURĂ. Orice bloc (mai puțin blocul 'decor', care
 *  își are propriul decor) poate avea un fundal decorativ în `props.bgDecor` — îl învelim cu un
 *  strat de decor în spate (z-index 0) și conținutul deasupra (z-index 1). */
export function compileBlocks(blocks: LpBlock[], ctx: { form: LpFormConfig }): string {
  return (Array.isArray(blocks) ? blocks : [])
    .map((b) => {
      const inner = compileBlock(b, ctx);
      if (!inner || b.type === 'decor') return inner;
      const decor = coerceToLpDecor((b.props || {}).bgDecor);
      if (decor.effect === 'none') return inner;
      const decorHtml = compileDecor(decor, `bg-${b.id}`, 'block');
      if (!decorHtml) return inner;
      return `<div style="position:relative;overflow:hidden">${decorHtml}<div style="position:relative;z-index:1">${inner}</div></div>`;
    })
    .join('\n');
}
