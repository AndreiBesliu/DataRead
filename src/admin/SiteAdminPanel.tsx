/**
 * Panou „Site" — administrarea designului + (în curând) a paginilor site-ului public. Felia B1: editarea
 * temei publice (culori/fonturi/imagine via ThemeControls) cu preview live + „Salvează & publică" în
 * `siteConfig/publicTheme` (Firestore). Site-ul public o aplică hibrid (snapshot copt + override runtime).
 * Decorul animat + CMS-ul de pagini (LP Studio) vin în felia B2.
 */
import { useEffect, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { coerceToCustomTheme, customThemeStyle, type CustomTheme } from '../theme/themes';
import ThemeControls from '../theme/ThemeControls';
import { PUBLIC_THEME_DEFAULT } from '../config/publicTheme';
import { SITE_PUBLIC_SCHEMA } from '../types/sitePublic';

export default function SiteAdminPanel({ adminUid }: { adminUid: string }) {
  const { t } = useTranslation();
  const [theme, setTheme] = useState<CustomTheme>(PUBLIC_THEME_DEFAULT);
  const [loaded, setLoaded] = useState(false);
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'err'>('idle');

  useEffect(() => {
    return onSnapshot(
      doc(db, 'siteConfig', 'publicTheme'),
      (snap) => {
        if (!loaded) {
          const d = snap.exists() ? (snap.data() as Record<string, unknown>) : null;
          setTheme(d && 'theme' in d ? coerceToCustomTheme(d.theme) : PUBLIC_THEME_DEFAULT);
          setLoaded(true);
        }
      },
      () => setLoaded(true),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const publish = async () => {
    setState('saving');
    try {
      await setDoc(doc(db, 'siteConfig', 'publicTheme'), {
        schema: SITE_PUBLIC_SCHEMA,
        theme: coerceToCustomTheme(theme),
        updatedAt: serverTimestamp(),
        updatedBy: adminUid,
      });
      setState('saved');
      setTimeout(() => setState('idle'), 2500);
    } catch (e) {
      console.warn('publish public theme failed:', e);
      setState('err');
    }
  };

  const card: CSSProperties = { background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 8, padding: 16 };

  return (
    <div style={{ marginTop: 12 }}>
      <h2 style={{ fontSize: 18, margin: '0 0 4px' }}>{t('admin.site.title')}</h2>
      <p style={{ fontSize: 13, color: 'var(--fg-1)', margin: '0 0 16px' }}>{t('admin.site.intro')}</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 360px) 1fr', gap: 20, alignItems: 'start' }}>
        {/* Editor temă */}
        <div style={card}>
          <h3 style={{ fontSize: 14, margin: '0 0 4px' }}>{t('admin.site.designTitle')}</h3>
          <ThemeControls value={theme} onChange={setTheme} withName={false} withFonts withAnimation={false} />
          <button className="btn btn-primary" disabled={state === 'saving'} onClick={() => void publish()} style={{ marginTop: 16, padding: '9px 18px', fontSize: 14 }}>
            {state === 'saving' ? t('admin.site.publishing') : state === 'saved' ? t('admin.site.published') : t('admin.site.publish')}
          </button>
          {state === 'err' && <p role="alert" style={{ color: '#c0392b', fontSize: 12, marginTop: 8 }}>{t('admin.site.publishErr')}</p>}
          <p style={{ fontSize: 11, color: 'var(--fg-1)', marginTop: 8 }}>{t('admin.site.publishHint')}</p>
        </div>

        {/* Preview live (culori + fundal; fonturile se văd pe site) */}
        <div>
          <h3 style={{ fontSize: 14, margin: '0 0 8px', color: 'var(--fg-1)' }}>{t('admin.site.previewTitle')}</h3>
          <div style={{ ...customThemeStyle(theme), borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)', minHeight: 240, padding: 24 }}>
            <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--accent)', fontWeight: 700 }}>{t('app.tagline')}</div>
            <h1 style={{ fontSize: 30, margin: '8px 0 10px', color: 'var(--fg-0)' }}>{t('admin.site.sampleHeading')}</h1>
            <p style={{ color: 'var(--fg-1)', margin: '0 0 16px', maxWidth: 520 }}>{t('admin.site.sampleText')}</p>
            <span style={{ display: 'inline-block', background: 'var(--accent)', color: 'var(--accent-contrast)', borderRadius: 8, padding: '10px 22px', fontWeight: 700 }}>{t('admin.site.sampleCta')}</span>
            <div style={{ marginTop: 18, background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 10, padding: 14, maxWidth: 360 }}>
              <strong style={{ color: 'var(--fg-0)' }}>{t('admin.site.sampleCardTitle')}</strong>
              <p style={{ color: 'var(--fg-1)', margin: '4px 0 0', fontSize: 13 }}>{t('admin.site.sampleCardText')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Pagini (CMS LP Studio) — felia B2 */}
      <div style={{ ...card, marginTop: 20, color: 'var(--fg-1)' }}>
        <h3 style={{ fontSize: 14, margin: '0 0 4px', color: 'var(--fg-0)' }}>{t('admin.site.pagesTitle')}</h3>
        <p style={{ fontSize: 13, margin: 0 }}>{t('admin.site.pagesSoon')}</p>
      </div>
    </div>
  );
}
