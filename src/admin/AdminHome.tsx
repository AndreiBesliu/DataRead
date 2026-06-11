import { Fragment, useEffect, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useAuthStore } from '../store/authStore';
import { coerceToClientProfile, type ClientProfile } from '../types/client';
import { coerceToOnboarding, type OnboardingData } from '../types/onboarding';
import AuthPanel from '../app/AuthPanel';

interface ClientRow {
  uid: string;
  profile: ClientProfile;
}

interface RequestRow {
  uid: string;
  email: string;
  displayName: string;
  requestedAt: unknown;
}

interface LeadRow {
  id: string;
  data: OnboardingData;
  createdAt: unknown;
}

function fmtTs(v: unknown): string {
  try {
    const d = (v as { toDate?: () => Date })?.toDate?.();
    return d ? d.toLocaleString('ro-RO') : '—';
  } catch {
    return '—';
  }
}

/** Detaliul unui onboarding/lead — refolosit de secțiunile Lead-uri și Clienți. */
function OnboardingDetail({ detail }: { detail: OnboardingData }) {
  const { t } = useTranslation();
  return (
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
  );
}

/** Ecranul pentru ne-admini: ÎNREGISTREAZĂ automat o cerere de acces (adminRequests/{uid}) —
 *  „dacă cineva încearcă să se logheze prin /admin, declanșează o cerere care trebuie aprobată".
 *  Primul admin (bootstrap) e auto-aprobat de functions. Self-healing: și butonul Reverifică
 *  re-asigură documentul de cerere (dacă a fost șters / creat înaintea trigger-ului, recrearea
 *  lui re-declanșează fluxul), iar după înregistrare urmează o reverificare automată — fluxul
 *  de bootstrap merge fără nicio acțiune manuală. */
function RequestAccess({ uid, email, displayName, onRecheck }: { uid: string; email: string | null; displayName: string | null; onRecheck: () => void }) {
  const { t } = useTranslation();

  const ensureRequest = async (): Promise<void> => {
    try {
      const ref = doc(db, 'adminRequests', uid);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        await setDoc(ref, {
          email: email ?? '',
          displayName: displayName ?? '',
          requestedAt: serverTimestamp(),
          status: 'pending',
        });
      }
    } catch (e) {
      console.warn('admin request register failed:', e);
    }
  };

  useEffect(() => {
    let t1: ReturnType<typeof setTimeout> | null = null;
    let t2: ReturnType<typeof setTimeout> | null = null;
    void ensureRequest().then(() => {
      // Bootstrap-ul / o aprobare proaspătă durează câteva secunde (trigger → claim) —
      // reverificăm automat de două ori înainte să lăsăm utilizatorul să apese manual.
      t1 = setTimeout(onRecheck, 4000);
      t2 = setTimeout(onRecheck, 10000);
    });
    return () => {
      if (t1) clearTimeout(t1);
      if (t2) clearTimeout(t2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  const recheck = () => {
    void ensureRequest().then(onRecheck);
  };

  return (
    <main data-page="admin-request" style={{ maxWidth: 560, margin: '0 auto', padding: '64px 24px', textAlign: 'center' }}>
      <h1 style={{ fontSize: 26 }}>{t('admin.accessTitle')}</h1>
      <p style={{ color: 'var(--fg-1)' }}>{t('admin.accessBody')}</p>
      <p style={{ fontSize: 13, color: 'var(--fg-1)' }}>{t('admin.accessUid')}</p>
      <code style={{ display: 'inline-block', background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 10px', fontSize: 13, userSelect: 'all' }}>
        {uid}
      </code>
      <div style={{ marginTop: 20, display: 'flex', gap: 10, justifyContent: 'center' }}>
        <button className="btn btn-primary" onClick={recheck}>{t('admin.accessRecheck')}</button>
        <Link to="/" className="btn">{t('notFound.back')}</Link>
      </div>
    </main>
  );
}

/** Panoul intern al operatorilor — gate pe claim-ul `admin`. v1: cereri de acces, lead-urile
 *  formularului public și clienții (conturi — dormant până revine self-serve). */
export default function AdminHome() {
  const { t } = useTranslation();
  const { user, initializing } = useAuthStore();
  const [isAdmin, setIsAdmin] = useState<'checking' | boolean>('checking');
  const [checkNonce, setCheckNonce] = useState(0);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [leads, setLeads] = useState<LeadRow[] | null>(null);
  const [clients, setClients] = useState<ClientRow[] | null>(null);
  const [openLead, setOpenLead] = useState<string | null>(null);
  const [openClient, setOpenClient] = useState<string | null>(null);
  const [clientDetail, setClientDetail] = useState<OnboardingData | null | 'loading'>(null);

  // Verifică claim-ul; un refresh forțat prinde claim-ul abia setat de trigger (bootstrap/aprobare).
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setIsAdmin('checking');
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
  }, [user, checkNonce]);

  // Cererile de acces în așteptare.
  useEffect(() => {
    if (isAdmin !== true) return;
    const q = query(collection(db, 'adminRequests'), where('status', '==', 'pending'));
    return onSnapshot(q, (snap) => {
      const out: RequestRow[] = [];
      snap.forEach((d) => {
        const x = d.data();
        out.push({
          uid: d.id,
          email: typeof x.email === 'string' ? x.email : '',
          displayName: typeof x.displayName === 'string' ? x.displayName : '',
          requestedAt: x.requestedAt,
        });
      });
      setRequests(out);
    }, (err) => console.warn('admin requests listener:', err));
  }, [isAdmin]);

  // Lead-urile formularului public.
  useEffect(() => {
    if (isAdmin !== true) return;
    const q = query(collection(db, 'leads'), orderBy('createdAt', 'desc'), limit(200));
    return onSnapshot(q, (snap) => {
      const out: LeadRow[] = [];
      snap.forEach((d) => out.push({ id: d.id, data: coerceToOnboarding(d.data()), createdAt: d.data().createdAt }));
      setLeads(out);
    }, (err) => {
      console.warn('admin leads listener:', err);
      setLeads([]);
    });
  }, [isAdmin]);

  // Clienții (conturi — relevant când revine self-serve).
  useEffect(() => {
    if (isAdmin !== true) return;
    const q = query(collection(db, 'clients'), orderBy('createdAt', 'desc'), limit(200));
    return onSnapshot(q, (snap) => {
      const out: ClientRow[] = [];
      snap.forEach((d) => {
        const p = coerceToClientProfile(d.data());
        if (p) out.push({ uid: d.id, profile: p });
      });
      setClients(out);
    }, (err) => {
      console.warn('admin clients listener:', err);
      setClients([]);
    });
  }, [isAdmin]);

  const approve = async (uid: string) => {
    try {
      // Crearea admins/{uid} declanșează onAdminWrite → claim + status 'approved' pe cerere.
      await setDoc(doc(db, 'admins', uid), { approvedBy: user?.uid ?? '', approvedAt: serverTimestamp() });
    } catch (e) {
      console.warn('approve failed:', e);
    }
  };

  const reject = async (uid: string) => {
    try {
      await updateDoc(doc(db, 'adminRequests', uid), { status: 'rejected', resolvedAt: serverTimestamp() });
    } catch (e) {
      console.warn('reject failed:', e);
    }
  };

  const toggleClientDetail = async (uid: string) => {
    if (openClient === uid) {
      setOpenClient(null);
      setClientDetail(null);
      return;
    }
    setOpenClient(uid);
    setClientDetail('loading');
    try {
      const snap = await getDoc(doc(db, 'clients', uid, 'onboarding', 'main'));
      setClientDetail(snap.exists() ? coerceToOnboarding(snap.data()) : null);
    } catch {
      setClientDetail(null);
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
    return <RequestAccess uid={user.uid} email={user.email} displayName={user.displayName} onRecheck={() => setCheckNonce((n) => n + 1)} />;
  }

  const td: CSSProperties = { padding: '8px 10px', borderBottom: '1px solid var(--border)', fontSize: 14, textAlign: 'left' };
  const sectionBox: CSSProperties = { background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflowX: 'auto', marginBottom: 28 };

  return (
    <main data-page="admin-home" style={{ maxWidth: 'var(--max-width)', margin: '0 auto', padding: '28px 24px' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, margin: 0 }}>{t('admin.title')}</h1>
        <span style={{ color: 'var(--fg-1)', fontSize: 14 }}>{user.email}</span>
      </header>

      {/* Cereri de acces backend. */}
      <h2 style={{ fontSize: 18, margin: '0 0 10px' }}>{t('admin.requestsTitle')}</h2>
      {requests.length === 0 ? (
        <p style={{ color: 'var(--fg-1)', fontSize: 14, marginBottom: 28 }}>{t('admin.requestsEmpty')}</p>
      ) : (
        <div style={sectionBox}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {requests.map((r) => (
                <tr key={r.uid}>
                  <td style={td}>{r.email || r.uid}</td>
                  <td style={td}>{r.displayName || '—'}</td>
                  <td style={td}>{t('admin.requestedAt')}: {fmtTs(r.requestedAt)}</td>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>
                    <button className="btn btn-primary" style={{ padding: '4px 12px', fontSize: 12, marginRight: 8 }} onClick={() => void approve(r.uid)}>
                      {t('admin.approve')}
                    </button>
                    <button className="btn" style={{ padding: '4px 12px', fontSize: 12 }} onClick={() => void reject(r.uid)}>
                      {t('admin.reject')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Lead-urile din formularul public /start. */}
      <h2 style={{ fontSize: 18, margin: '0 0 10px' }}>{t('admin.leadsTitle')}</h2>
      {leads === null && <p style={{ color: 'var(--fg-1)', fontSize: 14 }}>{t('admin.loading')}</p>}
      {leads !== null && leads.length === 0 && <p style={{ color: 'var(--fg-1)', fontSize: 14, marginBottom: 28 }}>{t('admin.leadsEmpty')}</p>}
      {leads !== null && leads.length > 0 && (
        <div style={sectionBox}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-0)' }}>
                <th style={td}>{t('admin.colDate')}</th>
                <th style={td}>{t('admin.colCompany')}</th>
                <th style={td}>{t('admin.colEmail')}</th>
                <th style={td}>{t('admin.colPhone')}</th>
                <th style={td}>{t('admin.fPackage')}</th>
                <th style={td}></th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <Fragment key={l.id}>
                  <tr>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>{fmtTs(l.createdAt)}</td>
                    <td style={td}>{l.data.companyName || '—'}</td>
                    <td style={td}>{l.data.contactEmail || '—'}</td>
                    <td style={td}>{l.data.contactPhone || '—'}</td>
                    <td style={td}>{l.data.packageInterest ? t(`pachete.${l.data.packageInterest}.name`) : '—'}</td>
                    <td style={td}>
                      <button className="btn" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setOpenLead(openLead === l.id ? null : l.id)}>
                        {openLead === l.id ? t('admin.hideDetail') : t('admin.viewDetail')}
                      </button>
                    </td>
                  </tr>
                  {openLead === l.id && (
                    <tr>
                      <td style={{ ...td, background: 'var(--bg-0)' }} colSpan={6}>
                        <OnboardingDetail detail={l.data} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Clienți cu cont (dormant până revine self-serve-ul Stripe). */}
      <h2 style={{ fontSize: 18, margin: '0 0 10px' }}>{t('admin.clientsTitle')}</h2>
      {clients === null && <p style={{ color: 'var(--fg-1)', fontSize: 14 }}>{t('admin.loading')}</p>}
      {clients !== null && clients.length === 0 && <p style={{ color: 'var(--fg-1)', fontSize: 14 }}>{t('admin.empty')}</p>}
      {clients !== null && clients.length > 0 && (
        <div style={sectionBox}>
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
              {clients.map(({ uid, profile }) => (
                <Fragment key={uid}>
                  <tr>
                    <td style={td}>{profile.email ?? '—'}</td>
                    <td style={td}>{profile.displayName ?? '—'}</td>
                    <td style={td}>{profile.onboardingStatus === 'submitted' ? `✓ ${t('admin.onboardingYes')}` : t('admin.onboardingNo')}</td>
                    <td style={{ ...td, fontWeight: 600, color: profile.entitlement?.active ? '#1e7e34' : 'var(--fg-1)' }}>
                      {profile.entitlement?.active ? t('admin.subActive') : t('admin.subNone')}
                    </td>
                    <td style={td}>
                      <button className="btn" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => void toggleClientDetail(uid)}>
                        {openClient === uid ? t('admin.hideDetail') : t('admin.viewDetail')}
                      </button>
                    </td>
                  </tr>
                  {openClient === uid && (
                    <tr>
                      <td style={{ ...td, background: 'var(--bg-0)' }} colSpan={5}>
                        {clientDetail === 'loading' && <span style={{ color: 'var(--fg-1)' }}>{t('admin.loading')}</span>}
                        {clientDetail === null && <span style={{ color: 'var(--fg-1)' }}>{t('admin.detailEmpty')}</span>}
                        {clientDetail !== null && clientDetail !== 'loading' && <OnboardingDetail detail={clientDetail} />}
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
