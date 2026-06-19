// Conector Google Ads — partea PURĂ: maparea unui rând GAQL pe modelul DailyMetric + construirea interogării
// GAQL. Fără I/O (fetch + refresh token în index.js). Testabil headless. CAPCANĂ CHEIE: `cost_micros` e în
// MICROS (1 EUR = 1.000.000) → împărțim la 1e6. API REST întoarce camelCase (costMicros); acceptăm ambele.
const GOOGLE_ADS_VERSION = 'v18';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function toNum(v) {
  const n = typeof v === 'number' ? v : parseFloat(String(v == null ? '' : v).replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/** Mapează un rând Google Ads (GAQL) → forma DailyMetric. cost_micros/1e6 (exact). Dată invalidă → date:''. */
function mapGoogleAdsRow(row) {
  const r = row && typeof row === 'object' ? row : {};
  const seg = r.segments && typeof r.segments === 'object' ? r.segments : {};
  const met = r.metrics && typeof r.metrics === 'object' ? r.metrics : {};
  const date = typeof seg.date === 'string' && DATE_RE.test(seg.date) ? seg.date : '';
  const costMicros = met.costMicros != null ? met.costMicros : met.cost_micros;
  const convVal = met.conversionsValue != null ? met.conversionsValue : met.conversions_value;
  return {
    date,
    spend: toNum(costMicros) / 1e6,
    impressions: Math.round(toNum(met.impressions)),
    clicks: Math.round(toNum(met.clicks)),
    leads: Math.round(toNum(met.conversions)),
    revenue: toNum(convVal),
    source: 'google',
  };
}

/** Mapează răspunsul searchStream (array de batch-uri `{results:[]}`) SAU search (`{results:[]}`) → metrici/zi. */
function mapGoogleAdsResponse(json) {
  let results = [];
  if (Array.isArray(json)) {
    for (const b of json) if (b && Array.isArray(b.results)) results = results.concat(b.results);
  } else if (json && Array.isArray(json.results)) {
    results = json.results;
  }
  return results.map(mapGoogleAdsRow).filter((m) => m.date);
}

/** GAQL per campanie, un rând per zi. campaignId sanitizat la întreg (anti-injecție în query). */
function buildGoogleAdsQuery(campaignId, since, until) {
  const id = Number(campaignId) || 0;
  return (
    'SELECT segments.date, metrics.cost_micros, metrics.impressions, metrics.clicks, ' +
    'metrics.conversions, metrics.conversions_value FROM campaign ' +
    `WHERE campaign.id = ${id} AND segments.date BETWEEN '${since}' AND '${until}'`
  );
}

function googleSearchStreamUrl(customerId) {
  const cid = String(customerId == null ? '' : customerId).replace(/[^0-9]/g, '');
  return `https://googleads.googleapis.com/${GOOGLE_ADS_VERSION}/customers/${cid}/googleAds:searchStream`;
}

module.exports = { GOOGLE_ADS_VERSION, mapGoogleAdsRow, mapGoogleAdsResponse, buildGoogleAdsQuery, googleSearchStreamUrl };
