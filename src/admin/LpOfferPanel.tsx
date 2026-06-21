/**
 * Panou „Ofertă & valabilitate" din LP Editor (Task #55) — termen de expirare al ofertei + ce se întâmplă după.
 * `expiresAt` se stochează ISO UTC (input datetime-local local → toISOString). După expirare, serveLp servește
 * pagina „ofertă expirată" (mode=message) sau face redirect (mode=redirect), iar hiturile se numără SEPARAT.
 */
import { useTranslation } from 'react-i18next';
import type { CSSProperties } from 'react';
import { type LpOffer, type LpOfferMode } from '../types/landingPage';

const field: CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, background: 'var(--bg-0)', color: 'var(--fg-0)' };
const label: CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, margin: '0 0 4px', color: 'var(--fg-1)' };
const card: CSSProperties = { background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 10, padding: 14, marginBottom: 14 };

/** ISO UTC stocat → valoarea câmpului datetime-local (ora LOCALĂ a operatorului). */
function isoToLocalInput(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
/** Valoarea datetime-local (oră locală) → ISO UTC pentru stocare (comparat la serve cu Date.now). */
function localInputToIso(local: string): string {
  if (!local) return '';
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString();
}

export default function LpOfferPanel({ value, onChange }: { value: LpOffer; onChange: (o: LpOffer) => void }) {
  const { t } = useTranslation();
  const set = (p: Partial<LpOffer>) => onChange({ ...value, ...p });
  const enabled = !!value.expiresAt;

  return (
    <div>
      <p style={{ fontSize: 12, color: 'var(--fg-1)', marginTop: 0 }}>{t('admin.lpStudio.offerIntro')}</p>

      <div style={card}>
        <label style={label}>{t('admin.lpStudio.offerExpiresAt')}
          <input type="datetime-local" style={field} value={isoToLocalInput(value.expiresAt)}
            onChange={(e) => set({ expiresAt: localInputToIso(e.target.value) })} />
        </label>
        {enabled
          ? <button className="btn" style={{ padding: '5px 12px', fontSize: 12, marginTop: 8 }} onClick={() => set({ expiresAt: '' })}>{t('admin.lpStudio.offerClear')}</button>
          : <p style={{ fontSize: 11, color: 'var(--fg-1)', margin: '4px 0 0' }}>{t('admin.lpStudio.offerNoneHint')}</p>}
      </div>

      {enabled && (
        <div style={card}>
          <label style={label}>{t('admin.lpStudio.offerMode')}
            <select style={field} value={value.mode} onChange={(e) => set({ mode: e.target.value as LpOfferMode })}>
              <option value="message">{t('admin.lpStudio.offerModeMessage')}</option>
              <option value="redirect">{t('admin.lpStudio.offerModeRedirect')}</option>
            </select>
          </label>

          {value.mode === 'message' ? (
            <div style={{ marginTop: 10 }}>
              <label style={label}>{t('admin.lpStudio.offerHeadline')}
                <input style={field} value={value.expiredHeadline} maxLength={120} placeholder={t('admin.lpStudio.offerHeadlinePh')} onChange={(e) => set({ expiredHeadline: e.target.value })} />
              </label>
              <label style={label}>{t('admin.lpStudio.offerMessage')}
                <textarea style={{ ...field, minHeight: 64, resize: 'vertical' }} value={value.expiredMessage} maxLength={600} placeholder={t('admin.lpStudio.offerMessagePh')} onChange={(e) => set({ expiredMessage: e.target.value })} />
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label style={label}>{t('admin.lpStudio.offerCtaText')}
                  <input style={field} value={value.expiredCtaText} maxLength={60} onChange={(e) => set({ expiredCtaText: e.target.value })} />
                </label>
                <label style={label}>{t('admin.lpStudio.offerCtaHref')}
                  <input style={field} value={value.expiredCtaHref} maxLength={500} placeholder="https://…" onChange={(e) => set({ expiredCtaHref: e.target.value })} />
                </label>
              </div>
            </div>
          ) : (
            <div style={{ marginTop: 10 }}>
              <label style={label}>{t('admin.lpStudio.offerRedirectUrl')}
                <input style={field} value={value.redirectUrl} maxLength={500} placeholder="https://…" onChange={(e) => set({ redirectUrl: e.target.value })} />
              </label>
              <p style={{ fontSize: 11, color: 'var(--fg-1)', margin: '4px 0 0' }}>{t('admin.lpStudio.offerRedirectHint')}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
