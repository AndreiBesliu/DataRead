/**
 * Sugestii proactive pentru operator — agregator PUR peste date DEJA generate (NU generează AI nou).
 * `buildSuggestions` e testabil headless (nowMs injectat); `SuggestionsPanel` normalizează snapshot-urile
 * Firestore (leads + campaigns) în input-urile simple (ms-uri) de aici. Sortare după severitate.
 */

export type SuggestionKind = 'leadUntouched' | 'leadStale' | 'campaignAction' | 'reportMissing';
export type SuggestionSeverity = 'high' | 'medium' | 'low';
export type SuggestionView = 'leads' | 'marketing';

export interface Suggestion {
  id: string;
  kind: SuggestionKind;
  severity: SuggestionSeverity;
  /** Cheie i18n pentru titlu (componenta face t(titleKey, params)). */
  titleKey: string;
  params: Record<string, string | number>;
  /** Text concret deja gata (nume firmă / headline insight) — afișat ca atare. */
  detail: string;
  /** Tabul-țintă la „Deschide". */
  view: SuggestionView;
  leadId?: string;
  campaignId?: string;
}

export interface SuggestionLead {
  id: string;
  companyName: string;
  status: string; // 'new' | 'contacted' | 'won' | 'lost'
  createdAtMs: number;
  reportAtMs: number; // 0 dacă nu există raport
  clientUid: string;
}

export interface SuggestionCampaign {
  id: string;
  name: string;
  leadId: string;
  clientName: string;
  verdict: string; // '' | 'scale' | 'maintain' | 'pause' | 'test'
  headline: string;
}

export const SUG_THRESHOLDS = { newDays: 2, contactedDays: 14 };
const DAY_MS = 86_400_000;
const SEV_RANK: Record<SuggestionSeverity, number> = { high: 0, medium: 1, low: 2 };

/** Cheia lună-an (UTC) — pentru „raport în luna curentă". Determinist (server scrie în UTC). */
function monthKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function buildSuggestions(input: { leads: SuggestionLead[]; campaigns: SuggestionCampaign[]; nowMs: number }): Suggestion[] {
  const leads = Array.isArray(input.leads) ? input.leads : [];
  const campaigns = Array.isArray(input.campaigns) ? input.campaigns : [];
  const nowMs = input.nowMs;
  const out: Suggestion[] = [];

  // 1) Lead-uri netratate (status + vechime).
  for (const l of leads) {
    const ageDays = l.createdAtMs > 0 ? Math.floor((nowMs - l.createdAtMs) / DAY_MS) : 0;
    if (l.status === 'new' && ageDays >= SUG_THRESHOLDS.newDays) {
      out.push({ id: `leadUntouched:${l.id}`, kind: 'leadUntouched', severity: 'high', titleKey: 'admin.sugLeadUntouched', params: { days: ageDays }, detail: l.companyName || l.id, view: 'leads', leadId: l.id });
    } else if (l.status === 'contacted' && ageDays >= SUG_THRESHOLDS.contactedDays) {
      out.push({ id: `leadStale:${l.id}`, kind: 'leadStale', severity: 'medium', titleKey: 'admin.sugLeadStale', params: { days: ageDays }, detail: l.companyName || l.id, view: 'leads', leadId: l.id });
    }
  }

  // 2) Campanii cu verdict AI de acțiune (din aiInsight).
  for (const c of campaigns) {
    if (c.verdict === 'pause' || c.verdict === 'test' || c.verdict === 'scale') {
      out.push({
        id: `campaignAction:${c.id}`,
        kind: 'campaignAction',
        severity: c.verdict === 'pause' ? 'high' : 'medium',
        titleKey: `admin.sugVerdict_${c.verdict}`,
        params: {},
        detail: [c.clientName, c.name, c.headline].filter(Boolean).join(' — '),
        view: 'marketing',
        campaignId: c.id,
        leadId: c.leadId,
      });
    }
  }

  // 3) Lead-uri cu campanii dar fără raport în luna curentă.
  const nowMonth = monthKey(nowMs);
  const leadsById = new Map(leads.map((l) => [l.id, l]));
  const seen = new Set<string>();
  for (const c of campaigns) {
    const leadId = c.leadId;
    if (!leadId || seen.has(leadId)) continue;
    seen.add(leadId);
    const l = leadsById.get(leadId);
    if (!l) continue;
    const hasReportThisMonth = l.reportAtMs > 0 && monthKey(l.reportAtMs) === nowMonth;
    if (!hasReportThisMonth) {
      out.push({ id: `reportMissing:${leadId}`, kind: 'reportMissing', severity: 'medium', titleKey: 'admin.sugReportMissing', params: {}, detail: l.companyName || leadId, view: 'marketing', leadId });
    }
  }

  out.sort((a, b) => SEV_RANK[a.severity] - SEV_RANK[b.severity] || a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id));
  return out;
}
