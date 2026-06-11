import { useTranslation } from 'react-i18next';

/** Pagini legale — PLACEHOLDER vizibil marcat DRAFT (cu noindex prin publicRoutes).
 *  Textele reale (avocat / entitate legală) sunt sarcină de owner înainte de lansare. */
export default function Legal({ kind }: { kind: 'termeni' | 'confidentialitate' }) {
  const { t } = useTranslation();
  const title = kind === 'termeni' ? t('legal.termsTitle') : t('legal.privacyTitle');
  const body = kind === 'termeni' ? t('legal.termsBody') : t('legal.privacyBody');

  return (
    <main data-page={`legal-${kind}`} style={{ maxWidth: 760, margin: '0 auto', padding: '48px 24px' }}>
      <div role="note" style={{ background: '#fff7e0', border: '1px solid #e6c75a', borderRadius: 'var(--radius)', padding: '10px 14px', fontWeight: 700, fontSize: 14, marginBottom: 24 }}>
        ⚠️ {t('legal.draftBanner')}
      </div>
      <h1 style={{ fontSize: 32 }}>{title}</h1>
      <p style={{ color: 'var(--fg-1)', lineHeight: 1.7 }}>{body}</p>
    </main>
  );
}
