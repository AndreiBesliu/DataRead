// Conector TikTok Ads — partea PURĂ: maparea unui rând din Reporting API (report/integrated) pe modelul
// DailyMetric + construirea URL-ului de raport. Fără I/O (fetch + Access-Token header în index.js). Testabil.
// `stat_time_day` vine ca „YYYY-MM-DD 00:00:00" → luăm primele 10 caractere.
const TIKTOK_API_VERSION = 'v1.3';
const DATE_RE = /^\d{4}-\d{2}-\d{2}/;

function toNum(v) {
  const n = typeof v === 'number' ? v : parseFloat(String(v == null ? '' : v).replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/** Mapează un rând TikTok report (dimensions+metrics) → forma DailyMetric. Dată invalidă → date:''. */
function mapTikTokRow(row) {
  const r = row && typeof row === 'object' ? row : {};
  const dim = r.dimensions && typeof r.dimensions === 'object' ? r.dimensions : {};
  const met = r.metrics && typeof r.metrics === 'object' ? r.metrics : {};
  const raw = typeof dim.stat_time_day === 'string' ? dim.stat_time_day : '';
  const date = DATE_RE.test(raw) ? raw.slice(0, 10) : '';
  const revenue = met.total_complete_payment_value != null ? met.total_complete_payment_value
    : (met.total_purchase_value != null ? met.total_purchase_value : met.complete_payment_value);
  return {
    date,
    spend: toNum(met.spend),
    impressions: Math.round(toNum(met.impressions)),
    clicks: Math.round(toNum(met.clicks)),
    leads: Math.round(toNum(met.conversion)),
    revenue: toNum(revenue),
    source: 'tiktok',
  };
}

/** Mapează răspunsul TikTok (`{ data: { list: [...] } }`) → metrici/zi valide. */
function mapTikTokResponse(json) {
  const list = json && json.data && Array.isArray(json.data.list) ? json.data.list : [];
  return list.map(mapTikTokRow).filter((m) => m.date);
}

/** URL-ul raportului integrat per campanie, un rând per zi. Token-ul merge în header Access-Token (în index.js). */
function buildTikTokReportUrl(advertiserId, campaignId, since, until) {
  const params = new URLSearchParams({
    advertiser_id: String(advertiserId == null ? '' : advertiserId),
    report_type: 'BASIC',
    data_level: 'AUCTION_CAMPAIGN',
    dimensions: JSON.stringify(['campaign_id', 'stat_time_day']),
    metrics: JSON.stringify(['spend', 'impressions', 'clicks', 'conversion', 'total_complete_payment_value']),
    filtering: JSON.stringify([{ field_name: 'campaign_ids', filter_type: 'IN', filter_value: JSON.stringify([String(campaignId)]) }]),
    start_date: since,
    end_date: until,
    page_size: '1000',
  });
  return `https://business-api.tiktok.com/open_api/${TIKTOK_API_VERSION}/report/integrated/get/?${params.toString()}`;
}

module.exports = { TIKTOK_API_VERSION, mapTikTokRow, mapTikTokResponse, buildTikTokReportUrl };
