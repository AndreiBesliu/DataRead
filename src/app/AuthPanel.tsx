import { useEffect, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/authStore';
import { isValidPackageId } from '../config/packages';

/** Cheia sessionStorage care păstrează pachetul ales pe site prin fluxul de autentificare. */
export const PKG_INTENT_KEY = 'dataread_pkg_intent';

type Mode = 'signin' | 'signup' | 'reset';

const field: CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  border: '1px solid var(--border)',
  borderRadius: 8,
  fontSize: 15,
  background: 'var(--bg-0)',
};

/** Câmp cu etichetă VIZIBILĂ (a11y): inputul stă în interiorul `<label>` → asociere implicită, citit
 *  de screen-reader și rămâne vizibil după ce începi să scrii (spre deosebire de placeholder). */
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: 'grid', gap: 4, fontSize: 13, fontWeight: 600, color: 'var(--fg-0)' }}>
      <span>{label}</span>
      {children}
    </label>
  );
}

export default function AuthPanel() {
  const { t } = useTranslation();
  const { busy, error, info, clearMessages, signInEmail, signUpEmail, signInGoogle, resetPassword } = useAuthStore();
  const [params] = useSearchParams();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [tos, setTos] = useState(false);
  const [tosError, setTosError] = useState(false);

  // ?pkg= de pe pagina de pachete supraviețuiește autentificării prin sessionStorage.
  useEffect(() => {
    const pkg = params.get('pkg');
    if (isValidPackageId(pkg)) {
      try {
        sessionStorage.setItem(PKG_INTENT_KEY, pkg);
      } catch {
        /* private mode */
      }
    }
  }, [params]);

  const switchMode = (m: Mode) => {
    setMode(m);
    setTosError(false);
    clearMessages();
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTosError(false);
    if (mode === 'reset') {
      void resetPassword(email);
      return;
    }
    if (mode === 'signup') {
      if (!tos) {
        setTosError(true);
        return;
      }
      void signUpEmail(email, password, name.trim() || undefined);
      return;
    }
    void signInEmail(email, password);
  };

  const google = () => {
    if (mode === 'signup' && !tos) {
      setTosError(true);
      return;
    }
    void signInGoogle(mode === 'signup' && tos);
  };

  const tabStyle = (active: boolean): CSSProperties => ({
    flex: 1,
    padding: '10px 0',
    border: 'none',
    borderBottom: active ? '2px solid var(--accent)' : '2px solid var(--border)',
    background: 'none',
    fontSize: 15,
    fontWeight: active ? 700 : 500,
    color: active ? 'var(--fg-0)' : 'var(--fg-1)',
    cursor: 'pointer',
  });

  return (
    <main data-page="auth" style={{ maxWidth: 420, margin: '0 auto', padding: '48px 24px' }}>
      <h1 style={{ fontSize: 26, textAlign: 'center', marginBottom: 20 }}>{t('auth.title')}</h1>

      <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '22px 20px' }}>
        {mode !== 'reset' && (
          <div style={{ display: 'flex', marginBottom: 18 }}>
            <button type="button" style={tabStyle(mode === 'signin')} onClick={() => switchMode('signin')}>
              {t('auth.signinTab')}
            </button>
            <button type="button" style={tabStyle(mode === 'signup')} onClick={() => switchMode('signup')}>
              {t('auth.signupTab')}
            </button>
          </div>
        )}

        <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
          {mode === 'signup' && (
            <Field label={t('auth.displayName')}>
              <input style={field} type="text" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            </Field>
          )}
          <Field label={t('auth.email')}>
            <input style={field} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </Field>
          {mode !== 'reset' && (
            <Field label={t('auth.password')}>
              <input
                style={field}
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              />
            </Field>
          )}

          {mode === 'signup' && (
            <label style={{ display: 'flex', gap: 8, fontSize: 13, color: tosError ? 'var(--danger)' : 'var(--fg-1)', alignItems: 'flex-start' }}>
              <input type="checkbox" checked={tos} onChange={(e) => { setTos(e.target.checked); setTosError(false); }} style={{ marginTop: 3 }} />
              <span>
                {t('auth.tos')}{' '}
                (<Link to="/legal/termeni" target="_blank">{t('footer.terms')}</Link>,{' '}
                <Link to="/legal/confidentialitate" target="_blank">{t('footer.privacy')}</Link>)
              </span>
            </label>
          )}
          {tosError && <div style={{ color: 'var(--danger)', fontSize: 13 }}>{t('auth.tosRequired')}</div>}
          {error && <div role="alert" style={{ color: 'var(--danger)', fontSize: 13 }}>{t(error)}</div>}
          {info && <div role="status" style={{ color: 'var(--success)', fontSize: 13 }}>{t(info)}</div>}

          <button className="btn btn-primary" type="submit" disabled={busy} style={{ width: '100%' }}>
            {busy ? t('auth.busy') : mode === 'signup' ? t('auth.signUp') : mode === 'reset' ? t('auth.sendReset') : t('auth.signIn')}
          </button>
        </form>

        {mode !== 'reset' && (
          <>
            <div style={{ textAlign: 'center', color: 'var(--fg-1)', fontSize: 13, margin: '12px 0' }}>{t('auth.or')}</div>
            <button className="btn" type="button" disabled={busy} onClick={google} style={{ width: '100%' }}>
              {t('auth.google')}
            </button>
          </>
        )}

        <div style={{ textAlign: 'center', marginTop: 14, fontSize: 13 }}>
          {mode === 'reset' ? (
            <button type="button" onClick={() => switchMode('signin')} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 13 }}>
              {t('auth.backToSignIn')}
            </button>
          ) : (
            <button type="button" onClick={() => switchMode('reset')} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 13 }}>
              {t('auth.forgot')}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
