import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import { useAuthStore } from '../store/authStore';
import { useEntitlementStore } from '../store/entitlementStore';
import { watchClientProfile } from '../services/clients';
import { createCheckoutSession, createPortalLink } from '../services/billing';
import { reportError } from '../services/errorReporting';
import type { ClientProfile } from '../types/client';
import { getPackage, isValidPackageId } from '../config/packages';
import AuthPanel, { PKG_INTENT_KEY } from './AuthPanel';

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

        {/* Secțiunile Verticalei 1 — pregătite structural, populate în felia 2. */}
        <Card title={t('appHome.requestsTitle')}>
          <p style={{ margin: 0, color: 'var(--fg-1)', fontSize: 14 }}>{t('appHome.comingSoon')}</p>
        </Card>
        <Card title={t('appHome.resultsTitle')}>
          <p style={{ margin: 0, color: 'var(--fg-1)', fontSize: 14 }}>{t('appHome.comingSoon')}</p>
        </Card>
        <Card title={t('appHome.insightsTitle')}>
          <p style={{ margin: 0, color: 'var(--fg-1)', fontSize: 14 }}>{t('appHome.comingSoon')}</p>
        </Card>
      </div>
    </main>
  );
}
