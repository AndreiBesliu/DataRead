import { useTranslation } from 'react-i18next';
import { SOCIAL_PROOF_STATS, SOCIAL_PROOF_TESTIMONIALS } from '../config/socialProof';

/** Bandă de dovadă socială pe homepage: cifre/capabilități REALE + (când există) testimoniale reale.
 *  Testimonialele se randează DOAR dacă `SOCIAL_PROOF_TESTIMONIALS` e ne-gol (nu inventăm pe site live). */
export default function SocialProof() {
  const { t } = useTranslation();
  return (
    <section style={{ maxWidth: 'var(--max-width)', margin: '0 auto', padding: '40px 24px 8px' }}>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
        {SOCIAL_PROOF_STATS.map((s) => (
          <div key={s.labelKey} style={{ flex: '1 1 160px', maxWidth: 220, textAlign: 'center', background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '18px 14px' }}>
            <div style={{ fontSize: 30, fontWeight: 800, color: 'var(--accent)', lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: 13, color: 'var(--fg-1)', marginTop: 6 }}>{t(s.labelKey)}</div>
          </div>
        ))}
      </div>

      {SOCIAL_PROOF_TESTIMONIALS.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, marginTop: 24 }}>
          {SOCIAL_PROOF_TESTIMONIALS.map((tm, i) => (
            <figure key={i} className="card" style={{ margin: 0 }}>
              <blockquote style={{ margin: 0, fontSize: 14, fontStyle: 'italic', color: 'var(--fg-0)' }}>“{tm.quote}”</blockquote>
              <figcaption style={{ marginTop: 10, fontSize: 13, color: 'var(--fg-1)' }}>
                <strong style={{ color: 'var(--fg-0)' }}>{tm.author}</strong>{tm.role ? ` · ${tm.role}` : ''}
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </section>
  );
}
