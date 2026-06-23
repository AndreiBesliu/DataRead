import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { httpsCallable } from 'firebase/functions';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db, functions } from '../firebase';
import {
  coerceToSeoAudit,
  seoGrade,
  SEO_GRADE_COLORS,
  type SeoAudit,
  type SeoSeverity,
} from '../types/seoAudit';

interface AuditRow { id: string; atMs: number; audit: SeoAudit }

const SEV_COLOR: Record<SeoSeverity, string> = { critical: '#e0454f', warning: '#d98e0b', good: '#1f9d57' };

/** Panou operator — modul „Automatizare SEO". Rulează un audit on-page pe un URL (callable seoAudit:
 *  fetch + extragere semnale + scor determinist + recomandări AI grounded) și arată rezultatul + istoricul.
 *  Operator-only; consumă quota AI. Monitorizarea de ranking (SERP) = felie ulterioară (chei API la Andrei). */
export default function SeoPanel() {
  const { t } = useTranslation();
  const [url, setUrl] = useState('');
  const [keyword, setKeyword] = useState('');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState<SeoAudit | null>(null);
  const [history, setHistory] = useState<AuditRow[]>([]);

  useEffect(() => {
    return onSnapshot(
      query(collection(db, 'seoAudits'), orderBy('createdAt', 'desc'), limit(20)),
      (snap) => setHistory(snap.docs.map((d) => {
        const at = d.data().createdAt as { toMillis?: () => number } | undefined;
        return { id: d.id, atMs: at && typeof at.toMillis === 'function' ? at.toMillis() : 0, audit: coerceToSeoAudit(d.data()) };
      })),
      () => setHistory([]),
    );
  }, []);

  const run = async () => {
    const u = url.trim();
    if (!u) return;
    setRunning(true);
    setError(null);
    try {
      const res = await httpsCallable(functions, 'seoAudit')({ url: u, keyword: keyword.trim() });
      setCurrent(coerceToSeoAudit({ ...(res.data as object), url: u, keyword: keyword.trim() }));
    } catch (e) {
      const code = (e as { code?: string; message?: string });
      setError(code.message || t('admin.seo.error'));
    } finally {
      setRunning(false);
    }
  };

  const input: CSSProperties = { width: '100%', boxSizing: 'border-box', background: 'var(--bg-0)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 10px', color: 'var(--fg-0)', fontSize: 13 };

  return (
    <div style={{ marginTop: 12 }}>
      <h2 style={{ fontSize: 18, margin: '0 0 4px' }}>{t('admin.seo.title')}</h2>
      <p style={{ fontSize: 12, color: 'var(--fg-1)', margin: '0 0 12px' }}>{t('admin.seo.hint')}</p>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: 8, alignItems: 'end', marginBottom: 16, maxWidth: 760 }}>
        <label><span style={{ display: 'block', fontSize: 11, color: 'var(--fg-1)', marginBottom: 3, fontWeight: 600 }}>{t('admin.seo.url')}</span>
          <input style={input} value={url} placeholder="https://exemplu.ro/pagina" onChange={(e) => setUrl(e.target.value)} /></label>
        <label><span style={{ display: 'block', fontSize: 11, color: 'var(--fg-1)', marginBottom: 3, fontWeight: 600 }}>{t('admin.seo.keyword')}</span>
          <input style={input} value={keyword} placeholder={t('admin.seo.keywordPh')} onChange={(e) => setKeyword(e.target.value)} /></label>
        <button type="button" className="btn btn-primary" style={{ fontSize: 13, padding: '9px 16px' }} disabled={running || !url.trim()} onClick={() => void run()}>
          {running ? t('admin.seo.running') : t('admin.seo.run')}
        </button>
      </div>
      {error && <div role="alert" style={{ color: '#e05666', fontSize: 13, marginBottom: 12 }}>{error}</div>}

      {current && <AuditView audit={current} />}

      {history.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h3 style={{ fontSize: 14, margin: '0 0 8px', color: 'var(--fg-1)' }}>{t('admin.seo.history')}</h3>
          <div style={{ display: 'grid', gap: 6 }}>
            {history.map((h) => (
              <button key={h.id} type="button" onClick={() => setCurrent(h.audit)} style={{ textAlign: 'left', display: 'flex', gap: 10, alignItems: 'center', background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 6, padding: '7px 10px', cursor: 'pointer', color: 'var(--fg-0)' }}>
                <span style={{ fontWeight: 800, fontSize: 13, color: SEO_GRADE_COLORS[seoGrade(h.audit.score)] }}>{h.audit.score}</span>
                <span style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{h.audit.url}</span>
                {h.audit.keyword ? <span style={{ fontSize: 11, color: 'var(--fg-1)' }}>„{h.audit.keyword}"</span> : null}
                {h.atMs ? <span style={{ fontSize: 11, color: 'var(--fg-1)' }}>{new Date(h.atMs).toLocaleDateString('ro-RO')}</span> : null}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AuditView({ audit }: { audit: SeoAudit }) {
  const { t } = useTranslation();
  const grade = seoGrade(audit.score);
  const s = audit.signals;
  const byPrio = useMemo(() => ({
    high: audit.recommendations.filter((r) => r.priority === 'high'),
    medium: audit.recommendations.filter((r) => r.priority === 'medium'),
    low: audit.recommendations.filter((r) => r.priority === 'low'),
  }), [audit.recommendations]);
  const fact = (label: string, value: string) => (
    <div style={{ fontSize: 12 }}><span style={{ color: 'var(--fg-1)' }}>{label}: </span><strong>{value}</strong></div>
  );

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 16, background: 'var(--bg-1)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ width: 64, height: 64, borderRadius: 12, background: SEO_GRADE_COLORS[grade], color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 22, fontWeight: 800, lineHeight: 1 }}>{audit.score}</span>
          <span style={{ fontSize: 11, fontWeight: 700 }}>{grade}</span>
        </div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontSize: 13, fontWeight: 700, wordBreak: 'break-all' }}>{audit.url}</div>
          {audit.summary ? <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--fg-1)' }}>{audit.summary}</p> : null}
        </div>
      </div>

      {s && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 6, marginTop: 14, padding: '12px 0', borderTop: '1px solid var(--border)' }}>
          {fact(t('admin.seo.f_title'), `${s.titleLength}`)}
          {fact(t('admin.seo.f_meta'), `${s.metaDescriptionLength}`)}
          {fact('H1', `${s.h1Count}`)}
          {fact('H2/H3', `${s.h2Count}/${s.h3Count}`)}
          {fact(t('admin.seo.f_words'), `${s.wordCount}`)}
          {fact(t('admin.seo.f_imgAlt'), `${s.imgMissingAlt}/${s.imgCount}`)}
          {fact(t('admin.seo.f_links'), `${s.internalLinks}/${s.externalLinks}`)}
          {audit.keyword ? fact(t('admin.seo.f_density'), `${s.keywordDensity}%`) : null}
        </div>
      )}

      {audit.issues.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <h4 style={{ fontSize: 13, margin: '0 0 6px' }}>{t('admin.seo.issues')}</h4>
          <div style={{ display: 'grid', gap: 4 }}>
            {audit.issues.map((i, idx) => (
              <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'baseline', fontSize: 13 }}>
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#fff', background: SEV_COLOR[i.severity], borderRadius: 4, padding: '1px 6px', flexShrink: 0 }}>{t(`admin.seo.sev_${i.severity}`)}</span>
                <span>{i.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {audit.recommendations.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <h4 style={{ fontSize: 13, margin: '0 0 6px' }}>{t('admin.seo.recommendations')}</h4>
          {(['high', 'medium', 'low'] as const).map((p) => byPrio[p].length > 0 && (
            <div key={p} style={{ marginBottom: 8 }}>
              {byPrio[p].map((r, idx) => (
                <div key={idx} style={{ borderLeft: `3px solid ${p === 'high' ? '#e0454f' : p === 'medium' ? '#d98e0b' : '#3fa66a'}`, padding: '2px 0 2px 10px', marginBottom: 6 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{r.title}</div>
                  {r.detail ? <div style={{ fontSize: 12, color: 'var(--fg-1)', marginTop: 2 }}>{r.detail}</div> : null}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
