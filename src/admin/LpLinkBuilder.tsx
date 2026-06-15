/**
 * Link Builder — compune linkuri etichetate (UTM) pentru o Landing Page și le salvează. Etichetarea
 * consistentă = atribuire curată: serveLp numără traficul DOAR pe variantele cunoscute (knownVariants
 * de pe LP, scris aici), restul → __other. Fiecare link salvat = un document `links/{id}`; cheia lui
 * (variantKey) leagă linkul de contorul `variants/{key}` pentru performanță (vizite/conversii).
 */
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { collection, deleteDoc, doc, onSnapshot, getDocs, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import {
  buildLpUrl, cleanAttr, variantKey, hasAttr,
  coerceToLpVariant, variantConvRate, coerceKnownVariants,
  LP_MEDIA, LP_PLATFORMS, LP_KNOWN_VARIANTS_MAX, LP_LINK_LABEL_MAX, type LpVariant,
} from '../types/lpAttribution';

interface SavedLink {
  id: string;
  label: string;
  url: string;
  variantKey: string;
  source: string;
  medium: string;
  campaign: string;
  content: string;
  createdAtMs: number;
}

function tsMs(v: unknown): number {
  const t = v as { toMillis?: () => number } | null;
  return t && typeof t.toMillis === 'function' ? t.toMillis() : 0;
}

export default function LpLinkBuilder({ slug, origin }: { slug: string; origin: string }) {
  const { t } = useTranslation();
  const [knownCount, setKnownCount] = useState(0); // live din doc-ul LP (nu prop stale) — pt. plafon + etichetă
  const [source, setSource] = useState('');
  const [medium, setMedium] = useState('');
  const [campaign, setCampaign] = useState('');
  const [content, setContent] = useState('');
  const [term, setTerm] = useState('');
  const [label, setLabel] = useState('');
  const [links, setLinks] = useState<SavedLink[]>([]);
  const [variants, setVariants] = useState<Record<string, LpVariant>>({});
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState('');
  const [saving, setSaving] = useState(false);

  const attr = useMemo(() => ({ source, medium, campaign, content, term }), [source, medium, campaign, content, term]);
  const url = useMemo(() => buildLpUrl(origin, slug, attr), [origin, slug, attr]);
  const key = useMemo(() => variantKey(attr), [attr]);
  const valid = hasAttr(cleanAttr(attr));

  // Allowlist-ul LIVE de pe LP (reflectă salvările din sesiune) — pt. plafon corect + contor exact.
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'landingPages', slug), (snap) => {
      setKnownCount(Object.keys(coerceKnownVariants(snap.data()?.knownVariants)).length);
    });
    return unsub;
  }, [slug]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'landingPages', slug, 'links'), (snap) => {
      const next = snap.docs.map((d) => {
        const x = d.data();
        return { id: d.id, label: String(x.label || ''), url: String(x.url || ''), variantKey: String(x.variantKey || ''), source: String(x.source || ''), medium: String(x.medium || ''), campaign: String(x.campaign || ''), content: String(x.content || ''), createdAtMs: tsMs(x.createdAt) };
      });
      next.sort((a, b) => b.createdAtMs - a.createdAtMs);
      setLinks(next);
    });
    return unsub;
  }, [slug]);

  // Performanța variantelor (o dată la montare) — pentru a arăta vizite/conversii lângă fiecare link.
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const snap = await getDocs(collection(db, 'landingPages', slug, 'variants'));
        if (cancel) return;
        const m: Record<string, LpVariant> = {};
        snap.docs.forEach((d) => { m[d.id] = coerceToLpVariant(d.id, d.data()); });
        setVariants(m);
      } catch { /* ignore */ }
    })();
    return () => { cancel = true; };
  }, [slug, links.length]);

  async function copy(text: string, id: string) {
    try { await navigator.clipboard.writeText(text); setCopied(id); setTimeout(() => setCopied(''), 1200); } catch { /* ignore */ }
  }

  async function save() {
    setErr('');
    if (!valid) { setErr(t('admin.lpStudio.lbErrEmpty')); return; }
    if (knownCount >= LP_KNOWN_VARIANTS_MAX) { setErr(t('admin.lpStudio.lbErrMax', { max: LP_KNOWN_VARIANTS_MAX })); return; }
    setSaving(true);
    try {
      const a = cleanAttr(attr);
      const batch = writeBatch(db);
      const linkRef = doc(collection(db, 'landingPages', slug, 'links'));
      batch.set(linkRef, {
        schema: 1,
        label: (label || `${a.source}/${a.medium}/${a.content}`).slice(0, LP_LINK_LABEL_MAX),
        source: a.source, medium: a.medium, campaign: a.campaign, content: a.content, term: a.term,
        url, variantKey: key, createdAt: serverTimestamp(),
      });
      // Allowlist pe LP: numai variantele cunoscute primesc contor dedicat (restul → __other).
      batch.update(doc(db, 'landingPages', slug), { [`knownVariants.${key}`]: true });
      await batch.commit();
      setCampaign(''); setContent(''); setTerm(''); setLabel('');
    } catch {
      setErr(t('admin.lpStudio.lbErrSave'));
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm(t('admin.lpStudio.lbConfirmDelete'))) return;
    await deleteDoc(doc(db, 'landingPages', slug, 'links', id)).catch(() => {});
    // Nu ștergem cheia din knownVariants (istoricul de trafic rămâne valid); linkul doar dispare din listă.
  }

  const fmtN = (n: number) => n.toLocaleString('ro-RO');
  const fmtPct = (n: number | null) => (n === null ? '—' : `${(n * 100).toFixed(1)}%`);

  const lbl: CSSProperties = { fontSize: 12, fontWeight: 700, color: 'var(--fg-1)', display: 'block', marginBottom: 4 };
  const inp: CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-0)', color: 'var(--fg-0)', fontSize: 14 };
  const btn: CSSProperties = { border: '1px solid var(--border)', borderRadius: 8, padding: '6px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer', background: 'var(--bg-0)', color: 'var(--fg-0)' };
  const btnPrimary: CSSProperties = { ...btn, background: 'var(--accent)', color: 'var(--accent-contrast)', border: '1px solid var(--accent)' };
  const td: CSSProperties = { padding: '6px 8px', borderBottom: '1px solid var(--border)', fontSize: 13, textAlign: 'left' };
  const tdNum: CSSProperties = { ...td, textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' };
  const field = (l: string, node: React.ReactNode) => (<div style={{ flex: '1 1 160px', minWidth: 140 }}><label style={lbl}>{l}</label>{node}</div>);

  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--fg-1)', marginTop: 0 }}>{t('admin.lpStudio.lbIntro')}</p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
        {field(t('admin.lpStudio.lbPlatform'), (
          <>
            <input list="lb-platforms" style={inp} value={source} placeholder="facebook" onChange={(e) => setSource(e.target.value)} />
            <datalist id="lb-platforms">{LP_PLATFORMS.map((p) => <option key={p} value={p} />)}</datalist>
          </>
        ))}
        {field(t('admin.lpStudio.lbMedium'), (
          <select style={inp} value={medium} onChange={(e) => setMedium(e.target.value)}>
            <option value="">—</option>
            {LP_MEDIA.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        ))}
        {field(t('admin.lpStudio.lbCampaign'), <input style={inp} value={campaign} placeholder="lansare-iarna" onChange={(e) => setCampaign(e.target.value)} />)}
        {field(t('admin.lpStudio.lbContent'), <input style={inp} value={content} placeholder="v2" onChange={(e) => setContent(e.target.value)} />)}
        {field(t('admin.lpStudio.lbTerm'), <input style={inp} value={term} placeholder="" onChange={(e) => setTerm(e.target.value)} />)}
        {field(t('admin.lpStudio.lbLabel'), <input style={inp} value={label} placeholder={t('admin.lpStudio.lbLabelPh')} onChange={(e) => setLabel(e.target.value)} />)}
      </div>

      <div style={{ background: 'var(--bg-0)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', marginBottom: 10, wordBreak: 'break-all', fontFamily: 'ui-monospace, monospace', fontSize: 12, color: valid ? 'var(--fg-0)' : 'var(--fg-1)' }}>{url}</div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button onClick={() => copy(url, 'preview')} style={btn}>{copied === 'preview' ? t('admin.lpStudio.lbCopied') : t('admin.lpStudio.lbCopy')}</button>
        <button onClick={save} disabled={!valid || saving} style={{ ...btnPrimary, opacity: !valid || saving ? 0.6 : 1 }}>{t('admin.lpStudio.lbSave')}</button>
        <span style={{ fontSize: 12, color: 'var(--fg-1)' }}>{t('admin.lpStudio.lbKnownCount', { n: knownCount, max: LP_KNOWN_VARIANTS_MAX })}</span>
      </div>
      {err ? <p style={{ color: '#c0392b', fontSize: 13 }}>{err}</p> : null}

      <h3 style={{ fontSize: 15, margin: '20px 0 8px' }}>{t('admin.lpStudio.lbSaved')} ({links.length})</h3>
      {links.length === 0 ? (
        <p style={{ color: 'var(--fg-1)', fontSize: 13 }}>{t('admin.lpStudio.lbNoneSaved')}</p>
      ) : (
        <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 10, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-0)' }}>
                <th style={td}>{t('admin.lpStudio.lbColLabel')}</th>
                <th style={td}>{t('admin.lpStudio.lbColTags')}</th>
                <th style={tdNum}>{t('admin.lpStudio.anVisits')}</th>
                <th style={tdNum}>{t('admin.lpStudio.ovLeads')}</th>
                <th style={tdNum}>{t('admin.lpStudio.colConv')}</th>
                <th style={td}></th>
              </tr>
            </thead>
            <tbody>
              {links.map((l) => {
                const v = variants[l.variantKey];
                return (
                  <tr key={l.id}>
                    <td style={td}>{l.label || <span style={{ color: 'var(--fg-1)' }}>—</span>}</td>
                    <td style={{ ...td, fontFamily: 'ui-monospace, monospace', fontSize: 11, color: 'var(--fg-1)' }}>{[l.source, l.medium, l.campaign, l.content].filter((x) => x && x !== '-').join(' · ')}</td>
                    <td style={tdNum}>{v ? fmtN(v.visits) : '0'}</td>
                    <td style={tdNum}>{v ? fmtN(v.submissions) : '0'}</td>
                    <td style={{ ...tdNum, color: 'var(--fg-1)' }}>{v ? fmtPct(variantConvRate(v)) : '—'}</td>
                    <td style={{ ...td, whiteSpace: 'nowrap', textAlign: 'right' }}>
                      <button onClick={() => copy(l.url, l.id)} style={{ ...btn, padding: '3px 9px', marginRight: 6 }}>{copied === l.id ? t('admin.lpStudio.lbCopied') : t('admin.lpStudio.lbCopy')}</button>
                      <button onClick={() => remove(l.id)} style={{ ...btn, padding: '3px 9px', color: '#c0392b' }}>{t('admin.lpStudio.delete')}</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
