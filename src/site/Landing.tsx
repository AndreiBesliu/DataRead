import { useTranslation } from 'react-i18next';

/** Stub de landing (Faza 1) — conținutul real vine în Faza 2 (site public complet). */
export default function Landing() {
  const { t } = useTranslation();
  return (
    <main data-page="landing" style={{ maxWidth: 'var(--max-width)', margin: '0 auto', padding: '64px 24px', textAlign: 'center' }}>
      <h1 style={{ fontSize: 40, marginBottom: 8 }}>{t('app.name')}</h1>
      <p style={{ fontSize: 18, color: 'var(--fg-1)' }}>{t('app.tagline')}</p>
    </main>
  );
}
