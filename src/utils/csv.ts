/**
 * Construire CSV sigură. Pe lângă escaparea ghilimelelor, neutralizează INJECȚIA DE FORMULE: o valoare
 * controlată de atacator (ex. ce a scris cineva în formularul public al unui LP) care începe cu =,+,-,@
 * sau tab/CR ar putea executa în Excel/Sheets la deschiderea fișierului. Prefixăm un apostrof.
 */
export function csvCell(value: unknown): string {
  let s = value == null ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

/** Un rând CSV din celule deja-text. */
export function csvRow(cells: unknown[]): string {
  return cells.map(csvCell).join(',');
}

/** Document CSV complet (rânduri de celule) — string gata de Blob. */
export function toCsv(rows: unknown[][]): string {
  return rows.map(csvRow).join('\n');
}
