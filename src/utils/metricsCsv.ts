/**
 * Parser PUR pentru import de metrici zilnice de campanie din CSV (export din Ads Manager sau din
 * exportul propriu al platformei). Fără dependențe, testat headless. Tolerant: detectează delimitatorul
 * (`;` sau `,`), mapează coloanele după NUME de antet (alias-uri ro/en, ordine liberă), acceptă numere în
 * format ro („1.234,56") sau en („1,234.56"), sare rândurile fără dată validă (raportate ca erori, nu crash).
 * Rândurile rezultate sunt date brute → trec apoi prin `coerceToDailyMetric` (plafon + source) la scriere.
 */
export interface ParsedMetricRow {
  date: string; // YYYY-MM-DD (validat)
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  revenue: number;
}

export interface MetricsCsvResult {
  rows: ParsedMetricRow[];
  errors: string[]; // mesaje lizibile (linie + motiv) pentru rândurile sărite / problemele de antet
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Antet → câmp intern. Acoperă exportul propriu (data;spend;…) + denumiri uzuale Meta/Google (ro+en).
const HEADER_ALIASES: Record<string, keyof ParsedMetricRow> = {
  date: 'date', data: 'date', day: 'date', ziua: 'date', zi: 'date',
  spend: 'spend', cost: 'spend', cheltuiala: 'spend', cheltuieli: 'spend', amount_spent: 'spend', 'amount spent': 'spend', suma_cheltuita: 'spend',
  impressions: 'impressions', afisari: 'impressions', afișări: 'impressions', impresii: 'impressions',
  clicks: 'clicks', clicuri: 'clicks', link_clicks: 'clicks', 'link clicks': 'clicks',
  leads: 'leads', 'lead-uri': 'leads', leaduri: 'leads', conversions: 'leads', conversii: 'leads', results: 'leads', rezultate: 'leads',
  revenue: 'revenue', venit: 'revenue', conversion_value: 'revenue', 'conversion value': 'revenue', value: 'revenue', valoare: 'revenue',
};

/** Normalizează un token de antet: scoate BOM/ghilimele/spații marginale, lowercase. */
function normHeader(h: string): string {
  return h.replace(/^﻿/, '').replace(/^"|"$/g, '').trim().toLowerCase();
}

/** Parsează un număr tolerant la formate ro/en + simboluri valutare; negativ/invalid → 0. */
export function parseLooseNumber(raw: string): number {
  let s = String(raw == null ? '' : raw).replace(/["\s€$%]/g, '').trim();
  if (!s) return 0;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma >= 0 && lastDot >= 0) {
    // Separatorul zecimal = ultimul dintre ele; restul sunt separatori de mii → eliminați.
    const dec = Math.max(lastComma, lastDot);
    s = s.slice(0, dec).replace(/[.,]/g, '') + '.' + s.slice(dec + 1).replace(/[.,]/g, '');
  } else if (lastComma >= 0) {
    // Doar virgule (fără punct). Dacă e grupare de mii — grupuri de EXACT 3 cifre, ex. „1,000,000" / „1,234" —
    // elimină virgulele (altfel „1,000,000" devenea 1). Altfel o virgulă e separator zecimal (ro: „12,50").
    // Cazul „1,234" e ambiguu (1234 en vs 1,234 ro); regula de 3 cifre alege interpretarea de mii (uzuală în export-uri).
    if (/^\d{1,3}(,\d{3})+$/.test(s)) s = s.replace(/,/g, '');
    else s = s.replace(/,/g, '.');
  }
  const n = parseFloat(s);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/** Împarte o linie CSV pe delimitator, respectând ghilimelele duble simple. */
function splitLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; } else inQ = !inQ;
    } else if (c === delim && !inQ) {
      out.push(cur); cur = '';
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

export function parseMetricsCsv(text: string): MetricsCsvResult {
  const errors: string[] = [];
  const raw = String(text == null ? '' : text).replace(/\r\n?/g, '\n').split('\n').filter((l) => l.trim() !== '');
  if (raw.length === 0) return { rows: [], errors: ['Fișier gol.'] };

  const headerLine = raw[0];
  const delim = headerLine.includes(';') ? ';' : ',';
  const headerCells = splitLine(headerLine, delim).map(normHeader);
  // colIndex[field] = indexul coloanei care mapează pe field (prima potrivire).
  const colIndex: Partial<Record<keyof ParsedMetricRow, number>> = {};
  headerCells.forEach((h, i) => {
    const field = HEADER_ALIASES[h];
    if (field && colIndex[field] === undefined) colIndex[field] = i;
  });
  if (colIndex.date === undefined) {
    return { rows: [], errors: ['Antet nerecunoscut: lipsește coloana de dată (date/data). Așteptat: date;spend;impressions;clicks;leads;revenue.'] };
  }

  const rows: ParsedMetricRow[] = [];
  const seen = new Set<string>();
  for (let i = 1; i < raw.length; i++) {
    const cells = splitLine(raw[i], delim);
    const at = (f: keyof ParsedMetricRow): string => {
      const idx = colIndex[f];
      return idx === undefined || idx >= cells.length ? '' : cells[idx];
    };
    const date = at('date').replace(/^"|"$/g, '').trim();
    if (!DATE_RE.test(date)) { errors.push(`Linia ${i + 1}: dată invalidă „${date}" (format așteptat YYYY-MM-DD) — sărită.`); continue; }
    if (seen.has(date)) { errors.push(`Linia ${i + 1}: dată duplicată „${date}" — păstrată ultima.`); }
    seen.add(date);
    // O dată duplicată: ultima câștigă (upsert pe cheia-dată, ca la scriere). Înlocuim rândul anterior.
    const row: ParsedMetricRow = {
      date,
      spend: parseLooseNumber(at('spend')),
      impressions: Math.round(parseLooseNumber(at('impressions'))),
      clicks: Math.round(parseLooseNumber(at('clicks'))),
      leads: Math.round(parseLooseNumber(at('leads'))),
      revenue: parseLooseNumber(at('revenue')),
    };
    const existing = rows.findIndex((r) => r.date === date);
    if (existing >= 0) rows[existing] = row; else rows.push(row);
  }
  return { rows, errors };
}
