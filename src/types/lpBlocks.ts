/**
 * Modelul de blocuri pentru builder-ul vizual al Landing Pages. O LP în mod „visual" stochează un
 * array de blocuri; `compileBlocks` le transformă în ACELAȘI `html` self-contained pe care serveLp
 * îl servește deja — deci servirea + regulile rămân neatinse. Blocurile folosesc variabilele de temă
 * (var(--accent) etc.), injectate de design. Compilarea e PURĂ (testabilă headless).
 */
import { LP_HP_FIELD, type LpFormConfig } from './landingPage';
import { coerceToLpDecor, compileDecor, defaultDecor } from './lpDecor';

export const LP_BLOCK_TYPES = ['hero', 'heading', 'text', 'image', 'button', 'features', 'testimonial', 'faq', 'form', 'spacer', 'decor', 'pricing', 'stats', 'logos', 'gallery', 'accordion', 'countdown', 'video'] as const;
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
    case 'pricing':
      return { columns: 3, items: [
        { title: 'Start', price: '149€', period: '/lună', features: 'Funcție inclusă\nFuncție inclusă', ctaText: 'Alege', ctaHref: '#' },
        { title: 'Pro', price: '399€', period: '/lună', features: 'Tot din Start\nFuncție extra', ctaText: 'Alege', ctaHref: '#' },
      ] };
    case 'stats':
      return { columns: 3, items: [{ value: '120+', label: 'Clienți' }, { value: '4.9', label: 'Rating' }, { value: '24h', label: 'Timp răspuns' }] };
    case 'logos':
      return { heading: 'Au avut încredere în noi', columns: 4, items: [{ url: '', alt: '' }] };
    case 'gallery':
      return { columns: 3, layout: 'grid', items: [{ url: '', alt: '' }] };
    case 'accordion':
      return { items: [{ q: 'Întrebare?', a: 'Răspuns.' }] };
    case 'countdown':
      return { heading: 'Oferta expiră în', targetDate: '', expiredText: 'Oferta a expirat.', align: 'center' };
    case 'video':
      return { url: '', title: '' };
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

/** Parsează o dată (ISO/text) → ms (int) sau null. PUR (Date.parse e determinist pe input; fără Date.now). */
function parseDateMs(v: unknown): number | null {
  const t = Date.parse(typeof v === 'string' ? v : '');
  return Number.isFinite(t) ? t : null;
}

/** Extrage DOAR un id valid din URL YouTube/Vimeo → src de embed ALLOWLIST. Provider necunoscut → ''.
 *  Charset-ul id-ului e restrâns (anti-injecție în atribut src). */
function ytVimeoEmbed(url: unknown): string {
  const u = typeof url === 'string' ? url : '';
  const yt = u.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}`;
  const vm = u.match(/vimeo\.com\/(?:video\/)?(\d{6,12})/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
  return '';
}

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
          if (f.type === 'radio') {
            // Grup de radio: un singur name, câte un input per opțiune; `required` pe primul (HTML cere doar pe unul din grup).
            const opts = (f.options || []).map((o, i) =>
              `<label style="display:flex;gap:8px;align-items:center;margin:0 0 8px;color:var(--fg-1)"><input type="radio" name="${escAttr(f.name)}" value="${escAttr(o)}"${i === 0 ? req : ''}> ${esc(o)}</label>`).join('');
            const legend = f.label || f.name ? `<div style="margin:0 0 8px;color:var(--fg-1);font-size:14px">${esc(f.label || f.name)}</div>` : '';
            return `<fieldset style="border:none;padding:0;margin:0 0 12px">${legend}${opts}</fieldset>`;
          }
          const t = f.type === 'email' ? 'email' : f.type === 'tel' ? 'tel' : f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text';
          return `<input type="${t}" ${common}>`;
        })
        .join('');
      const heading = str(p.heading) ? `<h2 style="text-align:center;color:var(--fg-0);margin:0 0 18px;font-size:26px">${esc(p.heading)}</h2>` : '';
      const submit = esc((ctx.form && ctx.form.submitLabel) || 'Trimite');
      // Honeypot anti-spam: câmp ascuns off-screen pe care un utilizator real nu-l vede/completează,
      // dar boții care completează orbește da. Server-side → fake-success fără scriere (vezi handleSubmit).
      const honeypot = `<input type="text" name="${LP_HP_FIELD}" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px;opacity:0;pointer-events:none">`;
      return `<section style="max-width:520px;margin:0 auto;padding:36px 24px">${heading}<form data-lp-form>${honeypot}${fields}<button type="submit" style="width:100%;background:var(--accent);color:var(--accent-contrast);border:none;padding:14px;border-radius:10px;font-weight:700;font-size:16px;cursor:pointer">${submit}</button></form></section>`;
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
    case 'pricing': {
      const cols = Math.min(Math.max(nbr(p.columns, 3), 1), 4);
      const cards = arr(p.items)
        .map((it) => {
          const feats = str(it.features, TXT).split('\n').map((l) => l.trim()).filter(Boolean)
            .map((l) => `<li style="padding:4px 0;color:var(--fg-1)">${esc(l)}</li>`).join('');
          const cta = str(it.ctaText)
            ? `<a data-cta href="${escAttr(safeHref(it.ctaHref))}" style="display:inline-block;margin-top:14px;background:var(--accent);color:var(--accent-contrast);padding:11px 24px;border-radius:8px;font-weight:700;text-decoration:none">${esc(it.ctaText)}</a>`
            : '';
          return `<div style="background:var(--bg-1);border:1px solid var(--border);border-radius:12px;padding:24px;text-align:center"><h3 style="margin:0 0 6px;font-size:20px;color:var(--fg-0)">${esc(str(it.title))}</h3><div style="font-size:30px;font-weight:800;color:var(--fg-0)">${esc(str(it.price, 40))}<span style="font-size:14px;font-weight:400;color:var(--fg-1)">${esc(str(it.period, 40))}</span></div><ul style="list-style:none;padding:0;margin:14px 0;text-align:left">${feats}</ul>${cta}</div>`;
        })
        .join('');
      return `<section style="${WRAP};padding:32px 24px"><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;max-width:${cols * 300}px;margin:0 auto">${cards}</div></section>`;
    }
    case 'stats': {
      const cols = Math.min(Math.max(nbr(p.columns, 3), 1), 4);
      const cells = arr(p.items)
        .map((it) => `<div style="text-align:center"><div style="font-size:clamp(28px,5vw,44px);font-weight:800;color:var(--accent);line-height:1">${esc(str(it.value, 40))}</div><div style="font-size:15px;color:var(--fg-1);margin-top:6px">${esc(str(it.label))}</div></div>`)
        .join('');
      return `<section style="${WRAP};padding:32px 24px"><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:20px;max-width:${cols * 220}px;margin:0 auto">${cells}</div></section>`;
    }
    case 'logos': {
      const cols = Math.min(Math.max(nbr(p.columns, 4), 2), 6);
      const imgs = arr(p.items)
        .map((it) => { const u = str(it.url, 600); return SAFE_URL.test(u) ? `<img src="${escAttr(u)}" alt="${escAttr(str(it.alt, 200))}" loading="lazy" style="max-height:46px;max-width:100%;object-fit:contain;opacity:.85">` : ''; })
        .filter(Boolean).join('');
      const heading = str(p.heading) ? `<p style="text-align:center;color:var(--fg-1);font-size:13px;text-transform:uppercase;letter-spacing:.5px;margin:0 0 18px">${esc(p.heading)}</p>` : '';
      return `<section style="${WRAP};padding:28px 24px">${heading}<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:24px;align-items:center;max-width:${cols * 160}px;margin:0 auto">${imgs}</div></section>`;
    }
    case 'gallery': {
      const cols = Math.min(Math.max(nbr(p.columns, 3), 1), 5);
      const carousel = p.layout === 'carousel';
      const imgs = arr(p.items)
        .map((it) => { const u = str(it.url, 600); return SAFE_URL.test(u) ? `<img src="${escAttr(u)}" alt="${escAttr(str(it.alt, 200))}" loading="lazy" style="${carousel ? 'flex:0 0 280px;scroll-snap-align:start;height:200px' : 'width:100%;height:200px'};object-fit:cover;border-radius:10px">` : ''; })
        .filter(Boolean).join('');
      if (carousel) return `<section style="${WRAP};padding:24px"><div style="display:flex;gap:14px;overflow-x:auto;scroll-snap-type:x mandatory;padding-bottom:8px">${imgs}</div></section>`;
      return `<section style="${WRAP};padding:24px"><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;max-width:${cols * 240}px;margin:0 auto">${imgs}</div></section>`;
    }
    case 'accordion': {
      const items = arr(p.items)
        .map((it) => `<details style="background:var(--bg-1);border:1px solid var(--border);border-radius:10px;padding:14px 18px;margin-bottom:10px"><summary style="cursor:pointer;font-weight:700;color:var(--fg-0)">${esc(str(it.q))}</summary><p style="margin:10px 0 0;color:var(--fg-1);line-height:1.6">${esc(str(it.a, TXT))}</p></details>`)
        .join('');
      return `<section style="max-width:760px;margin:0 auto;padding:32px 24px">${items}</section>`;
    }
    case 'countdown': {
      const a = align(p.align);
      const heading = str(p.heading) ? `<h2 style="font-size:24px;color:var(--fg-0);margin:0 0 16px">${esc(str(p.heading, TXT))}</h2>` : '';
      const ms = parseDateMs(p.targetDate);
      const exp = esc(str(p.expiredText, TXT));
      if (ms == null) return `<section style="${WRAP};padding:32px 24px;text-align:${a}">${heading}<p style="color:var(--fg-1);margin:0">${exp}</p></section>`;
      const id = ('cd-' + block.id).replace(/[^a-zA-Z0-9_-]/g, '');
      const cells = ['zile', 'ore', 'min', 'sec']
        .map((l) => `<div style="text-align:center;min-width:62px"><div data-cd="${l}" style="font-size:clamp(28px,5vw,44px);font-weight:800;color:var(--accent);line-height:1">--</div><div style="font-size:12px;color:var(--fg-1);text-transform:uppercase;margin-top:4px">${l}</div></div>`)
        .join('');
      const expHtml = JSON.stringify(`<p style="color:var(--fg-1);margin:0">${exp}</p>`);
      const script = `<script>(function(){var t=${ms},el=document.getElementById(${JSON.stringify(id)});if(!el)return;function p2(v){return(v<10?'0':'')+v;}function set(k,v){var n=el.querySelector('[data-cd="'+k+'"]');if(n)n.textContent=v;}function tick(){var d=t-Date.now();if(d<=0){el.innerHTML=${expHtml};if(el._i)clearInterval(el._i);return;}var s=Math.floor(d/1000);set('zile',p2(Math.floor(s/86400)));set('ore',p2(Math.floor(s%86400/3600)));set('min',p2(Math.floor(s%3600/60)));set('sec',p2(s%60));}tick();el._i=setInterval(tick,1000);})();</script>`;
      return `<section style="${WRAP};padding:32px 24px;text-align:${a}">${heading}<div id="${id}" style="display:inline-flex;gap:16px;justify-content:center;flex-wrap:wrap">${cells}</div></section>${script}`;
    }
    case 'video': {
      const src = ytVimeoEmbed(p.url);
      if (!src) return '';
      return `<section style="${WRAP};padding:24px"><div style="position:relative;width:100%;max-width:760px;margin:0 auto;aspect-ratio:16/9;border-radius:12px;overflow:hidden;background:#000"><iframe src="${escAttr(src)}" title="${escAttr(str(p.title, 140))}" loading="lazy" style="position:absolute;inset:0;width:100%;height:100%;border:0" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" referrerpolicy="strict-origin-when-cross-origin"></iframe></div></section>`;
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
