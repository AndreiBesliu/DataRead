// Conector Meta (Facebook/Instagram Ads) — partea PURĂ: maparea unui rând Insights (time_increment=1) pe
// modelul `DailyMetric` al platformei (vezi src/analytics/kpi.ts) + construirea cererii Graph API. Fără I/O
// aici (fetch-ul trăiește în index.js) → testabil headless. Documentat ca SIMPLIFICARE v1: „lead" = action_types
// de tip lead (campanii de lead-gen); „revenue" = valori de purchase. Obiectivele diferite se rafinează ulterior.

const META_GRAPH_VERSION = 'v21.0';

// Tipurile de acțiune Meta numărate ca lead / ca venit (purchase). Listele acoperă variantele uzuale.
const LEAD_ACTION_TYPES = [
  'lead',
  'onsite_conversion.lead_grouped',
  'offsite_conversion.fb_pixel_lead',
  'leadgen.other',
  'onsite_conversion.messaging_conversation_started_7d',
];
const PURCHASE_ACTION_TYPES = [
  'purchase',
  'omni_purchase',
  'offsite_conversion.fb_pixel_purchase',
  'onsite_web_purchase',
];

function toNum(v) {
  const n = typeof v === 'number' ? v : parseFloat(String(v == null ? '' : v).replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/** Însumează valorile dintr-un array Meta `actions`/`action_values` pentru tipurile date. */
function sumActions(arr, types) {
  if (!Array.isArray(arr)) return 0;
  let sum = 0;
  for (const a of arr) {
    if (a && typeof a === 'object' && types.includes(a.action_type)) sum += toNum(a.value);
  }
  return sum;
}

/** Mapează un rând Insights (o zi) → obiect în forma DailyMetric (fără schema/coerce — acelea se aplică la
 *  scriere, server-side). Dată invalidă → date:'' (apelantul sare rândul). */
function mapMetaInsight(row) {
  const d = row && typeof row === 'object' ? row : {};
  const date = typeof d.date_start === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.date_start) ? d.date_start : '';
  return {
    date,
    spend: toNum(d.spend),
    impressions: Math.round(toNum(d.impressions)),
    clicks: Math.round(toNum(d.clicks) || toNum(d.inline_link_clicks)),
    leads: Math.round(sumActions(d.actions, LEAD_ACTION_TYPES)),
    revenue: sumActions(d.action_values, PURCHASE_ACTION_TYPES),
    source: 'meta',
  };
}

/** Mapează un răspuns Insights întreg (`{ data: [...] }`) → metrici per zi valide (sare datele invalide). */
function mapMetaInsightsResponse(json) {
  const data = json && Array.isArray(json.data) ? json.data : [];
  return data.map(mapMetaInsight).filter((m) => m.date);
}

/** Construiește URL-ul Graph API Insights pentru un nod (campanie `<id>` sau cont `act_<id>`), pe o fereastră
 *  de zile, un rând per zi. `nodeId` validat de apelant. Token-ul merge ca query param. */
function buildMetaInsightsUrl(nodeId, sinceDate, untilDate, accessToken) {
  const fields = 'date_start,spend,impressions,clicks,inline_link_clicks,actions,action_values';
  const params = new URLSearchParams({
    time_increment: '1',
    time_range: JSON.stringify({ since: sinceDate, until: untilDate }),
    fields,
    limit: '500',
    access_token: String(accessToken == null ? '' : accessToken),
  });
  return `https://graph.facebook.com/${META_GRAPH_VERSION}/${encodeURIComponent(nodeId)}/insights?${params.toString()}`;
}

module.exports = {
  META_GRAPH_VERSION,
  LEAD_ACTION_TYPES,
  PURCHASE_ACTION_TYPES,
  mapMetaInsight,
  mapMetaInsightsResponse,
  buildMetaInsightsUrl,
};
