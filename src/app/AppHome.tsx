import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { collection, doc, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { deliverableFieldsFor, type RequestKind } from '../types/request';
import i18n from '../i18n';
import { useAuthStore } from '../store/authStore';
import { useEntitlementStore } from '../store/entitlementStore';
import { watchClientProfile } from '../services/clients';
import { createCheckoutSession, createPortalLink } from '../services/billing';
import { reportError } from '../services/errorReporting';
import type { ClientProfile } from '../types/client';
import { getPackage, isValidPackageId } from '../config/packages';
import { coerceToCampaign, coerceToReport, kpisFromTotals, type CampaignDef, type ClientReport } from '../analytics/kpi';
import AuthPanel, { PKG_INTENT_KEY } from './AuthPanel';

const PLATFORM_LABEL: Record<string, string> = { meta: 'Meta', google: 'Google', tiktok: 'TikTok', other: 'Alt' };
const portalMoney = (n: number) => `€${n.toLocaleString('ro-RO', { maximumFractionDigits: 2 })}`;
const portalRoas = (n: number | null) => (n === null ? '—' : `${n.toFixed(2)}×`);

/** Portalul de marketing al clientului: campaniile LUI (scoped pe clientUid prin rules) cu KPI +
 *  raportul lunar (oglindit în clients/{uid} de functions). Read-only — operatorii gestionează tot. */
function MarketingPortal({ uid }: { uid: string }) {
  const { t } = useTranslation();
  const [camps, setCamps] = useState<Array<{ id: string; data: CampaignDef }> | null>(null);
  const [report, setReport] = useState<ClientReport | null>(null);
  const [deliv, setDeliv] = useState<Array<{ id: string; kind: RequestKind; title: string; deliverables: Record<string, string> }>>([]);

  useEffect(() => {
    const off1 = onSnapshot(
      query(collection(db, 'campaigns'), where('clientUid', '==', uid)),
      (snap) => {
        const out: Array<{ id: string; data: CampaignDef }> = [];
        snap.forEach((d) => {
          const c = coerceToCampaign(d.data());
          if (c) out.push({ id: d.id, data: c });
        });
        setCamps(out);
      },
      () => setCamps([])
    );
    const off2 = onSnapshot(
      doc(db, 'clients', uid),
      (snap) => setReport(coerceToReport(snap.data()?.marketingReport)),
      () => {}
    );
    const off3 = onSnapshot(
      query(collection(db, 'clients', uid, 'deliverables'), orderBy('updatedAt', 'desc')),
      (snap) => {
        const out: Array<{ id: string; kind: RequestKind; title: string; deliverables: Record<string, string> }> = [];
        snap.forEach((d) => {
          const x = d.data();
          const del: Record<string, string> = {};
          if (x.deliverables && typeof x.deliverables === 'object') {
            for (const [k, v] of Object.entries(x.deliverables as Record<string, unknown>)) if (typeof v === 'string') del[k] = v;
          }
          out.push({ id: d.id, kind: x.kind === 'content' ? 'content' : 'campaign', title: typeof x.title === 'string' ? x.title : '', deliverables: del });
        });
        setDeliv(out);
      },
      () => setDeliv([])
    );
    return () => {
      off1();
      off2();
      off3();
    };
  }, [uid]);

  if (camps === null) return null;
  const hasData = camps.length > 0 || report !== null || deliv.length > 0;

  return (
    <section style={{ marginTop: 28 }}>
      <h2 style={{ fontSize: 20, marginBottom: 12 }}>{t('appHome.portalTitle')}</h2>
      {!hasData && <p style={{ color: 'var(--fg-1)' }}>{t('appHome.portalNotLinked')}</p>}

      {report && (
        <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '18px 16px', marginBottom: 16 }}>
          <h3 style={{ margin: '0 0 10px', fontSize: 17 }}>{t('appHome.portalReportTitle')}</h3>
          {[['reportSummary', report.summary], ['reportHighlights', report.highlights], ['reportRecommendations', report.recommendations]].map(([k, body]) =>
            body.trim() ? (
              <div key={k} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--fg-1)' }}>{t(`admin.${k}`)}</div>
                <div style={{ fontSize: 14, whiteSpace: 'pre-wrap' }}>{body}</div>
              </div>
            ) : null
          )}
        </div>
      )}

      {camps.length > 0 && (
        <>
          <h3 style={{ fontSize: 16, margin: '0 0 10px' }}>{t('appHome.portalCampaigns')}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
            {camps.map(({ id, data }) => {
              const k = kpisFromTotals(data.totals);
              const cell = (label: string, val: string, hero?: boolean) => (
                <div>
                  <div style={{ fontSize: 11, color: 'var(--fg-1)', textTransform: 'uppercase', letterSpacing: 0.3 }}>{label}</div>
                  <div style={{ fontSize: hero ? 18 : 14, fontWeight: 700, color: hero ? 'var(--accent, #2563eb)' : 'var(--fg-0)' }}>{val}</div>
                </div>
              );
              return (
                <div key={id} style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <strong style={{ fontSize: 15 }}>{data.name}</strong>
                    <span style={{ fontSize: 11, color: 'var(--fg-1)' }}>{PLATFORM_LABEL[data.platform] ?? data.platform}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                    {cell(t('admin.kpiRoas'), portalRoas(k.roas), true)}
                    {cell(t('admin.kpiSpend'), portalMoney(k.spend))}
                    {cell(t('admin.kpiLeads'), String(k.leads))}
                    {cell(t('admin.kpiCpl'), k.cpl === null ? '—' : portalMoney(k.cpl))}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {deliv.length > 0 && (
        <>
          <h3 style={{ fontSize: 16, margin: '24px 0 10px' }}>{t('appHome.portalDeliverables')}</h3>
          <div style={{ display: 'grid', gap: 12 }}>
            {deliv.map((d) => (
              <div key={d.id} style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <strong style={{ fontSize: 15 }}>{d.title || '—'}</strong>
                  <span style={{ fontSize: 11, color: 'var(--fg-1)' }}>{t(d.kind === 'content' ? 'admin.reqKindContent' : 'admin.reqKindCampaign')}</span>
                </div>
                {deliverableFieldsFor(d.kind)
                  .filter((f) => f.key !== 'notes' && d.deliverables[f.key]?.trim())
                  .map((f) => (
                    <div key={f.key} style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3, color: 'var(--fg-1)' }}>{t(f.labelKey)}</div>
                      <div style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{d.deliverables[f.key]}</div>
                    </div>
                  ))}
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function fmtDate(ms: number): string {
  try {
    return new Date(ms).toLocaleDateString(i18n.language === 'en' ? 'en-GB' : 'ro-RO');
  } catch {
    return '';
  }
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '18px 16px' }}>
      <h2 style={{ margin: '0 0 8px', fontSize: 17 }}>{title}</h2>
      {children}
    </div>
  );
}

/** Dashboardul clientului. Structura prevede de pe acum secțiunile Verticalei 1 (cereri de
 *  marketing / rezultate / AI insights) — „în curând" în v1, populate în felia 2. */
export default function AppHome() {
  const { t } = useTranslation();
  const { user, initializing, signOutUser } = useAuthStore();
  const ent = useEntitlementStore();
  const { search } = useLocation();
  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [billingBusy, setBillingBusy] = useState(false);
  const [billingError, setBillingError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      useEntitlementStore.getState().reset();
      return;
    }
    useEntitlementStore.getState().init(user.uid);
    return watchClientProfile(user.uid, setProfile);
  }, [user]);

  if (initializing) {
    return <main data-page="app-loading" style={{ padding: 64, textAlign: 'center', color: 'var(--fg-1)' }}>…</main>;
  }
  if (!user) return <AuthPanel />;

  let pkgIntent: string | null = null;
  try {
    pkgIntent = sessionStorage.getItem(PKG_INTENT_KEY);
  } catch {
    /* private mode */
  }
  const intent = isValidPackageId(pkgIntent) ? getPackage(pkgIntent) : null;
  const subActive = ent.status === 'active';
  const checkoutSuccess = new URLSearchParams(search).get('checkout') === 'success';
  const pending = checkoutSuccess && !subActive && !ent.needsResync;
  const activePkg = ent.packageId ? getPackage(ent.packageId) : null;
  const onboardingDone = profile?.onboardingStatus === 'submitted';

  const startCheckout = async () => {
    if (!intent?.priceId) return;
    setBillingBusy(true);
    setBillingError(null);
    try {
      const url = await createCheckoutSession(user.uid, intent.priceId);
      window.location.href = url;
    } catch (e) {
      reportError(e, { kind: 'checkout' });
      setBillingError('appHome.checkoutError');
      setBillingBusy(false);
    }
  };

  const openPortal = async () => {
    setBillingBusy(true);
    setBillingError(null);
    try {
      const url = await createPortalLink();
      window.location.href = url;
    } catch (e) {
      reportError(e, { kind: 'portal' });
      setBillingError('appHome.portalError');
      setBillingBusy(false);
    }
  };

  return (
    <main data-page="app-home" style={{ maxWidth: 'var(--max-width)', margin: '0 auto', padding: '28px 24px' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, margin: 0 }}>{t('appHome.title')}</h1>
        <span style={{ color: 'var(--fg-1)', fontSize: 14 }}>{user.email}</span>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
          <Link to="/" className="btn" style={{ padding: '6px 12px', fontSize: 13 }}>
            {t('appHome.backToSite')}
          </Link>
          <button className="btn" style={{ padding: '6px 12px', fontSize: 13 }} onClick={() => void signOutUser()}>
            {t('appHome.signOut')}
          </button>
        </span>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        <Card title={t('appHome.onboardingTitle')}>
          <p style={{ margin: '0 0 10px', color: 'var(--fg-1)', fontSize: 14 }}>
            {onboardingDone ? t('appHome.onboardingSubmitted') : t('appHome.onboardingNone')}
          </p>
          <Link to="/app/onboarding" className="btn btn-primary" style={{ fontSize: 14, padding: '8px 14px' }}>
            {onboardingDone ? t('appHome.onboardingEdit') : t('appHome.onboardingCta')}
          </Link>
        </Card>

        <Card title={t('appHome.subscriptionTitle')}>
          <p data-testid="subscription-status" style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 700, color: subActive ? '#1e7e34' : pending ? 'var(--accent)' : 'var(--fg-1)' }}>
            {subActive
              ? `${t('appHome.subscriptionActive')}${activePkg ? ` — ${t(activePkg.nameKey)}` : ''}`
              : pending
                ? t('appHome.subscriptionPending')
                : ent.needsResync
                  ? t('appHome.subscriptionExpired')
                  : t('appHome.subscriptionNone')}
          </p>
          {subActive && ent.subscription?.currentPeriodEnd && (
            <p style={{ margin: '0 0 10px', color: 'var(--fg-1)', fontSize: 13 }}>
              {t(ent.subscription.cancelAtPeriodEnd ? 'appHome.subscriptionEnds' : 'appHome.subscriptionRenews', {
                date: fmtDate(ent.subscription.currentPeriodEnd),
              })}
            </p>
          )}
          {!subActive && !pending && intent && (
            <p style={{ margin: '0 0 10px', color: 'var(--fg-1)', fontSize: 14 }}>
              {t('appHome.packageIntent', { name: t(intent.nameKey) })}
            </p>
          )}
          {billingError && <p role="alert" style={{ margin: '0 0 10px', color: '#c0392b', fontSize: 13 }}>{t(billingError)}</p>}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {subActive && (
              <button className="btn" style={{ fontSize: 14, padding: '8px 14px' }} disabled={billingBusy} onClick={() => void openPortal()}>
                {t('appHome.subscriptionManage')}
              </button>
            )}
            {ent.needsResync && (
              <button className="btn" style={{ fontSize: 14, padding: '8px 14px' }} disabled={billingBusy} onClick={() => void ent.resync()}>
                {t('appHome.subscriptionResync')}
              </button>
            )}
            {!subActive && !pending && intent && (
              intent.priceId ? (
                <button className="btn btn-primary" style={{ fontSize: 14, padding: '8px 14px' }} disabled={billingBusy} onClick={() => void startCheckout()}>
                  {t('appHome.subscriptionCheckout', { name: t(intent.nameKey), amount: intent.monthlyAmount })}
                </button>
              ) : (
                <Link to="/contact" className="btn btn-primary" style={{ fontSize: 14, padding: '8px 14px' }}>
                  {t('appHome.subscriptionContact')}
                </Link>
              )
            )}
          </div>
        </Card>

      </div>

      {/* Portalul de marketing — datele reale ale clientului (read-only). */}
      <MarketingPortal uid={user.uid} />
    </main>
  );
}
