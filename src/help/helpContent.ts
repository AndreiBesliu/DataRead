/**
 * Structura secțiunii de Ghid/Documentație — SCHELET (titluri + subtitluri), per modul, pe audiență.
 * Conține DOAR chei i18n; conținutul (corpul) se completează incremental (viitor `bodyKey` pe item).
 * `HelpView` randează aceste secțiuni. Acoperirea cheilor în locale e verificată headless (test).
 */
export interface HelpItem {
  titleKey: string;
  /** Corpul explicativ — adăugat incremental; cât lipsește, se afișează placeholder „în curând". */
  bodyKey?: string;
}

export interface HelpSection {
  id: string;
  titleKey: string;
  items: HelpItem[];
}

/** Helper: secțiune cu `n` subtitluri pe convenția `help.<id>` (titlu) + `help.<id>_<k>` (subtitlu) +
 *  `help.<id>_<k>_b` (corpul explicativ). Toate cheile sunt verificate headless (test acoperire). */
function sec(id: string, n: number): HelpSection {
  return {
    id,
    titleKey: `help.${id}`,
    items: Array.from({ length: n }, (_, i) => ({ titleKey: `help.${id}_${i + 1}`, bodyKey: `help.${id}_${i + 1}_b` })),
  };
}

/** Ghidul operatorului/adminului (/admin) — SEPARAT de ghidul clientului. */
export const OPERATOR_HELP: HelpSection[] = [
  sec('opLeads', 6),
  sec('opSuggestions', 3),
  sec('opRequests', 5),
  sec('opOpportunities', 3),
  sec('opMarketing', 4),
  sec('opConnectors', 4),
  sec('opAutomation', 7),
  sec('opLp', 9),
  sec('opAdmins', 3),
  sec('opPdf', 2),
];

/** Ghidul clientului (/app) — SEPARAT de ghidul operatorului. NB: clientul NU construiește automatizări (acelea sunt
 *  unealta agenției); el doar (a) folosește self-serve „Self Marketing" și (b) vede rezultatele pe care i le generăm. */
export const CLIENT_HELP: HelpSection[] = [
  sec('clAccount', 2),
  sec('clSelf', 6),
  sec('clPerformance', 2),
  sec('clReport', 2),
  sec('clDeliverables', 2),
  sec('clLp', 3),
  sec('clAlerts', 2),
];
