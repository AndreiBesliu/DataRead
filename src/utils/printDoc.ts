/**
 * Export PDF prin print-to-PDF din browser — FĂRĂ dependență (regula CLAUDE.md de minimizare deps).
 * Compunem un document HTML brandat A4 (print CSS, fundal alb) și-l tipărim într-un iframe ascuns →
 * utilizatorul alege „Salvează ca PDF" în dialogul de print. `escapeHtml` + `composePrintHtml` sunt PURE
 * (testate headless). TOT textul user/AI e ESCAPAT — un document de print nu trebuie să poată fi injectat
 * cu markup din raport/livrabile (text liber). `printHtmlDoc` e singurul side-effect (DOM, doar în browser).
 */

export function escapeHtml(v: unknown): string {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface PrintSection {
  label: string;
  body: string;
}

export interface PrintDocInput {
  title: string; // <title> + antet — devine numele implicit al fișierului în dialogul de print
  brand?: string; // implicit „DataRead"
  meta?: string[]; // linii sub antet (ex. „Client: X", „Generat: …")
  sections: PrintSection[];
}

const PRINT_CSS = [
  '@page{size:A4;margin:18mm 16mm}',
  '*{box-sizing:border-box}',
  'html,body{margin:0;padding:0;background:#fff;color:#16213a;font-family:Arial,Helvetica,sans-serif;font-size:12pt;line-height:1.5}',
  'header{border-bottom:2px solid #2e7fff;padding-bottom:8px;margin-bottom:14px}',
  '.brand{font-size:20pt;font-weight:800;color:#0a1228;letter-spacing:-0.5px}',
  'h1{font-size:15pt;margin:6px 0 2px}',
  '.meta{font-size:9.5pt;color:#5a6b8c}',
  'section{margin:0 0 14px;page-break-inside:avoid}',
  'h2{font-size:11pt;text-transform:uppercase;letter-spacing:0.5px;color:#2e7fff;border-bottom:1px solid #e2e8f0;padding-bottom:3px;margin:0 0 6px}',
  '.body{white-space:pre-wrap;font-size:11pt}',
  'footer{margin-top:18px;border-top:1px solid #e2e8f0;padding-top:6px;font-size:8.5pt;color:#8a9ac0}',
].join('');

/** PUR: compune documentul HTML de print (A4, brandat, alb). Sare secțiunile goale. Escapează tot. */
export function composePrintHtml(input: PrintDocInput): string {
  const title = escapeHtml(input.title || 'DataRead');
  const brand = escapeHtml(input.brand || 'DataRead');
  const meta = (input.meta || [])
    .filter((m) => typeof m === 'string' && m.trim())
    .map((m) => `<div class="meta">${escapeHtml(m)}</div>`)
    .join('');
  const sections = (input.sections || [])
    .filter((s) => s && typeof s.body === 'string' && s.body.trim())
    .map((s) => `<section><h2>${escapeHtml(s.label)}</h2><div class="body">${escapeHtml(s.body)}</div></section>`)
    .join('');
  return [
    '<!doctype html><html lang="ro"><head><meta charset="utf-8">',
    `<title>${title}</title><style>${PRINT_CSS}</style></head><body>`,
    `<header><div class="brand">${brand}</div><h1>${title}</h1>${meta}</header>`,
    sections || '<p style="color:#8a9ac0">—</p>',
    `<footer>${brand} — ${title}</footer>`,
    '</body></html>',
  ].join('');
}

/** SIDE-EFFECT (doar browser): tipărește documentul într-un iframe ascuns (anti popup-blocker). */
export function printHtmlDoc(html: string): void {
  try {
    const iframe = document.createElement('iframe');
    Object.assign(iframe.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' });
    iframe.setAttribute('aria-hidden', 'true');
    document.body.appendChild(iframe);
    const win = iframe.contentWindow;
    const doc = win && win.document;
    if (!win || !doc) {
      iframe.remove();
      return;
    }
    let removed = false;
    const cleanup = () => {
      if (removed) return;
      removed = true;
      setTimeout(() => iframe.remove(), 800);
    };
    win.onafterprint = cleanup;
    doc.open();
    doc.write(html);
    doc.close();
    // mică întârziere ca layout-ul/fonturile să se așeze înainte de print
    setTimeout(() => {
      try {
        win.focus();
        win.print();
      } catch (e) {
        console.warn('print failed:', e);
      }
      cleanup();
    }, 250);
  } catch (e) {
    console.warn('printHtmlDoc failed:', e);
  }
}

/** Slug simplu pentru titlul documentului (numele fișierului implicit la „Salvează ca PDF"). */
export function printTitle(parts: Array<string | undefined>): string {
  return parts.filter((p) => typeof p === 'string' && p.trim()).join(' — ').slice(0, 120) || 'DataRead';
}
