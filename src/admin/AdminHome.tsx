import { Fragment, useEffect, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { collection, doc, getDoc, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useAuthStore } from '../store/authStore';
import { coerceToClientProfile, type ClientProfile } from '../types/client';
import { coerceToOnboarding, type OnboardingData } from '../types/onboarding';
import AuthPanel from '../app/AuthPanel';

interface Row {
  uid: string;
  profile: ClientProfile;
}

/** Panoul intern al operatorilor — gate pe claim-ul `admin` (setat de functions/onAdminWrite
 *  pe baza admins/{uid}). v1: lista clienților + detaliul onboarding-ului. Crește în felia 2
 *  cu campanii + AI tools. */
export default function AdminHome() {
  const { t } = useTranslation();
  const { user, initializing } = useAuthStore();
  const [isAdmin, setIsAdmin] = useState<'checking' | boolean>('checking');
  const [rows, setRows] = useState<Row[] | null>(null);
  const [openUid, setOpenUid] = useState<string | null>(null);
  const [detail, setDetail] = useState<OnboardingData | null | 'loading'>(null);

  // Verifică claim-ul; dacă lipsește, un singur refresh forțat (claim setat recent de trigger).
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const u = auth.currentUser;
      if (!u) return;
      try {
        let tok = await u.getIdTokenResult();
        if (tok.claims.admin !== true) tok = await u.getIdTokenResult(true);
        if (!cancelled) setIsAdmin(tok.claims.admin === true);
      } catch {
        if (!cancelled) setIsAdmin(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Lista clienților (doar după confirmarea claim-ului — altfel rules refuză).
  useEffect(() => {
    if (isAdmin !== true) return;
    const q = query(collection(db, 'clients'), orderBy('createdAt', 'desc'), limit(200));
    return onSnapshot(
      q,
      (snap) => {
        const out: Row[] = [];
        snap.forEach((d) => {
          const p = coerceToClientProfile(d.data());
          if (p) out.push({ uid: d.id, profile: p });
        });
        setRows(out);
      },
      (err) => {
        console.warn('admin clients listener:', err);
        setRows([]);
      }
    );
  }, [isAdmin]);

  const toggleDetail = async (uid: string) => {
    if (openUid === uid) {
      setOpenUid(null);
      setDetail(null);
      return;
    }
    setOpenUid(uid);
    setDetail('loading');
    try {
      const snap = await getDoc(doc(db, 'clients', uid, 'onboarding', 'main'));
      setDetail(snap.exists() ? coerceToOnboarding(snap.data()) : null);
    } catch {
      setDetail(null);
    }
  };

  if (initializing) {
    return <main data-page="admin-loading" style={{ padding: 64, textAlign: 'center', color: 'var(--fg-1)' }}>…</main>;
  }
  if (!user) return <AuthPanel />;

  if (isAdmin === 'checking') {
    return <main data-page="admin-loading" style={{ padding: 64, textAlign: 'center', color: 'var(--fg-1)' }}>{t('admin.loading')}</main>;
  }

  if (isAdmin === false) {
    return (
      <main data-page="admin-denied" style={{ maxWidth: 560, margin: '0 auto', padding: '64px 24px', textAlign: 'center' }}>
        <h1 style={{ fontSize: 26 }}>{t('admin.title')}</h1>
        <p style={{ color: 'var(--fg-1)' }}>{t('admin.denied')}</p>
        <p style={{ fontSize: 13, color: 'var(--fg-1)' }}>{t('admin.deniedHint')}</p>
        <code style={{ display: 'inline-block', background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 10px', fontSize: 13, userSelect: 'all' }}>
          {user.uid}
        </code>
        <div style={{ marginTop: 20 }}>
          <Link to="/app" className="btn">{t('admin.backToApp')}</Link>
        </div>
      </main>
    );
  }

  const td: CSSProperties = { padding: '8px 10px', borderBottom: '1px solid var(--border)', fontSize: 14, textAlign: 'left' };

  return (
    <main data-page="admin-home" style={{ maxWidth: 'var(--max-width)', margin: '0 auto', padding: '28px 24px' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, margin: 0 }}>{t('admin.title')} — {t('admin.clientsTitle')}</h1>
        <Link to="/app" className="btn" style={{ marginLeft: 'auto', padding: '6px 12px', fontSize: 13 }}>
          {t('admin.backToApp')}
        </Link>
      </header>

      {rows === null && <p style={{ color: 'var(--fg-1)' }}>{t('admin.loading')}</p>}
      {rows !== null && rows.length === 0 && <p style={{ color: 'var(--fg-1)' }}>{t('admin.empty')}</p>}

      {rows !== null && rows.length > 0 && (
        <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-0)' }}>
                <th style={td}>{t('admin.colEmail')}</th>
                <th style={td}>{t('admin.colName')}</th>
                <th style={td}>{t('admin.colOnboarding')}</th>
                <th style={td}>{t('admin.colSubscription')}</th>
                <th style={td}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ uid, profile }) => (
                <Fragment key={uid}>
                  <tr>
                    <td style={td}>{profile.email ?? '—'}</td>
                    <td style={td}>{profile.displayName ?? '—'}</td>
                    <td style={td}>{profile.onboardingStatus === 'submitted' ? `✓ ${t('admin.onboardingYes')}` : t('admin.onboardingNo')}</td>
                    <td style={{ ...td, fontWeight: 600, color: profile.entitlement?.active ? '#1e7e34' : 'var(--fg-1)' }}>
                      {profile.entitlement?.active ? t('admin.subActive') : t('admin.subNone')}
                    </td>
                    <td style={td}>
                      <button className="btn" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => void toggleDetail(uid)}>
                        {openUid === uid ? t('admin.hideDetail') : t('admin.viewDetail')}
                      </button>
                    </td>
                  </tr>
                  {openUid === uid && (
                    <tr>
                      <td style={{ ...td, background: 'var(--bg-0)' }} colSpan={5}>
                        {detail === 'loading' && <span style={{ color: 'var(--fg-1)' }}>{t('admin.loading')}</span>}
                        {detail === null && <span style={{ color: 'var(--fg-1)' }}>{t('admin.detailEmpty')}</span>}
                        {detail !== null && detail !== 'loading' && (
                          <dl style={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: '4px 14px', margin: 0, fontSize: 13 }}>
                            <dt style={{ fontWeight: 700 }}>{t('admin.fCompany')}</dt>
                            <dd style={{ margin: 0 }}>{detail.companyName || '—'} {detail.cui && `(${t('admin.fCui')}: ${detail.cui})`}</dd>
                            <dt style={{ fontWeight: 700 }}>{t('admin.fContact')}</dt>
                            <dd style={{ margin: 0 }}>{[detail.contactName, detail.contactEmail, detail.contactPhone].filter(Boolean).join(' · ') || '—'}</dd>
                            <dt style={{ fontWeight: 700 }}>{t('admin.fWebsite')}</dt>
                            <dd style={{ margin: 0 }}>{detail.website || '—'}</dd>
                            <dt style={{ fontWeight: 700 }}>{t('admin.fIndustry')}</dt>
                            <dd style={{ margin: 0 }}>
                              {detail.industry ? t(`onboarding.industries.${detail.industry}`) : '—'}
                              {detail.industry === 'other' && detail.industryOther ? ` — ${detail.industryOther}` : ''}
                            </dd>
                            <dt style={{ fontWeight: 700 }}>{t('admin.fObjectives')}</dt>
                            <dd style={{ margin: 0 }}>{detail.objectives.map((o) => t(`onboarding.objective.${o}`)).join(', ') || '—'}</dd>
                            <dt style={{ fontWeight: 700 }}>{t('admin.fBudget')}</dt>
                            <dd style={{ margin: 0 }}>{detail.adBudget ? t(`onboarding.budget.${detail.adBudget}`) : '—'}</dd>
                            <dt style={{ fontWeight: 700 }}>{t('admin.fSocial')}</dt>
                            <dd style={{ margin: 0 }}>{[detail.facebook, detail.instagram, detail.tiktok].filter(Boolean).join(' · ') || '—'}</dd>
                            <dt style={{ fontWeight: 700 }}>{t('admin.fPackage')}</dt>
                            <dd style={{ margin: 0 }}>{detail.packageInterest ? t(`pachete.${detail.packageInterest}.name`) : '—'}</dd>
                            <dt style={{ fontWeight: 700 }}>{t('admin.fDescription')}</dt>
                            <dd style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{detail.description || '—'}</dd>
                          </dl>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
