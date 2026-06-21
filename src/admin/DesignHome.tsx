/**
 * „Design & Pagini" — tab unic în /admin care comasează tot ce ține de DESIGN/CONȚINUT: Landing Pages (LP Studio,
 * campanii) + Site (tema publică, chrome, paginile de site). Sub-tab-uri interne. Analytics-ul NU mai trăiește aici
 * (s-a mutat în Marketing Center) — separăm „proiectarea" de „măsurarea".
 */
import { useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import LandingStudio from './LandingStudio';
import SiteAdminPanel from './SiteAdminPanel';

type DesignTab = 'landing' | 'site';

export default function DesignHome({ adminUid }: { adminUid: string }) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<DesignTab>('landing');

  const btn = (on: boolean): CSSProperties => ({
    padding: '6px 14px', fontSize: 14, cursor: 'pointer', background: 'none', border: 'none',
    fontWeight: on ? 800 : 600, color: on ? 'var(--accent, #2563eb)' : 'var(--fg-1)',
    borderBottom: on ? '2px solid var(--accent, #2563eb)' : '2px solid transparent',
  });

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', gap: 6, borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
        <button onClick={() => setTab('landing')} style={btn(tab === 'landing')}>{t('admin.navLanding')}</button>
        <button onClick={() => setTab('site')} style={btn(tab === 'site')}>{t('admin.navSite')}</button>
      </div>
      {tab === 'landing' && <LandingStudio adminUid={adminUid} />}
      {tab === 'site' && <SiteAdminPanel adminUid={adminUid} />}
    </div>
  );
}
