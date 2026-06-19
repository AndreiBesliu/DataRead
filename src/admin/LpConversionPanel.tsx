/**
 * Panou „Conversie" din LP Editor — nudge-uri la nivel de pagină (slice 3b): bară CTA fixă (sticky) +
 * popup la intenția de ieșire (exit-intent). Configurarea se compilează în `conversionHtml` (compileConversion)
 * la salvare și e injectată de serveLp. Câmpuri structurate; stilul vine din tema paginii (var(--accent)…).
 */
import { useTranslation } from 'react-i18next';
import type { CSSProperties } from 'react';
import type { LpConversion } from '../types/landingPage';

const field: CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, background: 'var(--bg-0)', color: 'var(--fg-0)' };
const label: CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, margin: '0 0 4px', color: 'var(--fg-1)' };
const card: CSSProperties = { background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 10, padding: 14, marginBottom: 14 };
const toggle: CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 14, cursor: 'pointer' };

export default function LpConversionPanel({ value, onChange }: { value: LpConversion; onChange: (c: LpConversion) => void }) {
  const { t } = useTranslation();
  const sc = value.stickyCta;
  const ep = value.exitPopup;
  const setSticky = (p: Partial<LpConversion['stickyCta']>) => onChange({ ...value, stickyCta: { ...sc, ...p } });
  const setExit = (p: Partial<LpConversion['exitPopup']>) => onChange({ ...value, exitPopup: { ...ep, ...p } });

  return (
    <div>
      <p style={{ fontSize: 12, color: 'var(--fg-1)', marginTop: 0 }}>{t('admin.lpStudio.convIntro')}</p>

      {/* Sticky CTA */}
      <div style={card}>
        <label style={toggle}>
          <input type="checkbox" checked={sc.enabled} onChange={(e) => setSticky({ enabled: e.target.checked })} />
          {t('admin.lpStudio.convStickyTitle')}
        </label>
        {sc.enabled && (
          <div style={{ marginTop: 10 }}>
            <label style={label}>{t('admin.lpStudio.convStickyText')}
              <input style={field} value={sc.text} maxLength={80} onChange={(e) => setSticky({ text: e.target.value })} />
            </label>
            <label style={label}>{t('admin.lpStudio.convHref')}
              <input style={field} value={sc.href} maxLength={500} placeholder="#contact · https://…" onChange={(e) => setSticky({ href: e.target.value })} />
            </label>
          </div>
        )}
      </div>

      {/* Exit-intent popup */}
      <div style={card}>
        <label style={toggle}>
          <input type="checkbox" checked={ep.enabled} onChange={(e) => setExit({ enabled: e.target.checked })} />
          {t('admin.lpStudio.convExitTitle')}
        </label>
        {ep.enabled && (
          <div style={{ marginTop: 10 }}>
            <label style={label}>{t('admin.lpStudio.convExitHeading')}
              <input style={field} value={ep.heading} maxLength={120} onChange={(e) => setExit({ heading: e.target.value })} />
            </label>
            <label style={label}>{t('admin.lpStudio.convExitText')}
              <textarea style={{ ...field, minHeight: 64, resize: 'vertical' }} value={ep.text} maxLength={400} onChange={(e) => setExit({ text: e.target.value })} />
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <label style={label}>{t('admin.lpStudio.convCtaText')}
                <input style={field} value={ep.ctaText} maxLength={60} onChange={(e) => setExit({ ctaText: e.target.value })} />
              </label>
              <label style={label}>{t('admin.lpStudio.convHref')}
                <input style={field} value={ep.ctaHref} maxLength={500} onChange={(e) => setExit({ ctaHref: e.target.value })} />
              </label>
            </div>
            <p style={{ fontSize: 11, color: 'var(--fg-1)', margin: '4px 0 0' }}>{t('admin.lpStudio.convExitHint')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
