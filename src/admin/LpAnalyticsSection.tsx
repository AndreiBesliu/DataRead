/**
 * Analytics Landing Pages în Marketing Center — alegi o pagină → vezi performanța ei (trafic/conversie/variante +
 * rezultate A/B) și constructorul de linkuri etichetate (UTM). MUTAT din editorul LP (LpEditor), ca să separăm
 * proiectarea (tab-ul „Design") de măsurare (Marketing Center). Citește landingPages (admin) doar pentru lista de alegere.
 */
import { useEffect, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../firebase';
import LpAnalytics from './LpAnalytics';
import LpLinkBuilder from './LpLinkBuilder';

const ORIGIN = ((import.meta.env?.VITE_SITE_ORIGIN as string) || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '');

export default function LpAnalyticsSection() {
  const { t } = useTranslation();
  const [pages, setPages] = useState<Array<{ id: string; title: string }>>([]);
  const [slug, setSlug] = useState('');

  useEffect(() => {
    const off = onSnapshot(query(collection(db, 'landingPages')), (s) => {
      setPages(s.docs
        .map((d) => ({ id: d.id, title: typeof d.data().title === 'string' && d.data().title ? (d.data().title as string) : d.id }))
        .sort((a, b) => a.title.localeCompare(b.title)));
    }, () => setPages([]));
    return off;
  }, []);

  const inp: CSSProperties = { padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, background: 'var(--bg-1)', color: 'var(--fg-0)', minWidth: 260 };

  return (
    <section style={{ marginTop: 8, marginBottom: 26 }}>
      <h2 style={{ fontSize: 18, margin: '0 0 4px' }}>{t('admin.lpAnalyticsTitle')}</h2>
      <p style={{ fontSize: 12, color: 'var(--fg-1)', margin: '0 0 10px', maxWidth: 640 }}>{t('admin.lpAnalyticsHint')}</p>
      <select style={inp} value={slug} onChange={(e) => setSlug(e.target.value)}>
        <option value="">{t('admin.lpAnalyticsPick')}</option>
        {pages.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
      </select>

      {slug && (
        <div style={{ marginTop: 14 }}>
          <LpAnalytics slug={slug} />
          <details style={{ marginTop: 16 }}>
            <summary style={{ cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>🔗 {t('admin.lpStudio.tabLinks')}</summary>
            <div style={{ marginTop: 10 }}><LpLinkBuilder slug={slug} origin={ORIGIN} /></div>
          </details>
        </div>
      )}
    </section>
  );
}
