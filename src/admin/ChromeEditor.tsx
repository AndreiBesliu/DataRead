/**
 * Editor de chrome global (header/topbar + footer + meniu) pentru panoul „Site". Câmpuri STRUCTURATE
 * (nu block-builder): brand + slogane, listă meniu (label ro/en + link intern, add/remove/reordonare),
 * CTA, text footer + linkuri footer. Etichetele sunt LITERALE per-limbă (EN cade pe RO la servire). Stilul
 * vine din tema publică (B1). Previzualizarea randează header+footer pe `customThemeStyle(theme)`, comutabilă
 * RO/EN. Părintele (SiteAdminPanel) deține încărcarea/publicarea în `siteConfig/publicChrome`.
 */
import { useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { customThemeStyle, type CustomTheme } from '../theme/themes';
import { CHROME_ITEMS_MAX, CHROME_EMPHASES, CHROME_ANIMS, chromeLabel, chromeItemClass, internalHref, type ChromeItem, type SiteChrome } from '../types/siteChrome';
import { toLocalizedPath } from '../i18n/routing';

const inputStyle: CSSProperties = {
  width: '100%', boxSizing: 'border-box', background: 'var(--bg-0)', border: '1px solid var(--border)',
  borderRadius: 6, padding: '7px 9px', color: 'var(--fg-0)', fontSize: 13,
};
const labelStyle: CSSProperties = { display: 'block', fontSize: 11, color: 'var(--fg-1)', margin: '0 0 3px', fontWeight: 600 };

function Field({ label, value, onChange, placeholder, maxLength }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; maxLength?: number;
}) {
  return (
    <label style={{ display: 'block', marginBottom: 8 }}>
      <span style={labelStyle}>{label}</span>
      <input style={inputStyle} value={value} placeholder={placeholder} maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

const selectStyle: CSSProperties = { ...inputStyle, padding: '6px 8px', cursor: 'pointer' };

/** Editor de listă de linkuri (nav sau footer): labelRo/labelEn/href + add/remove/reordonare, plafon comun.
 *  `styled` (doar nav): expune stilul de evidențiere (CTA) + animația + culoarea per item. */
function ItemListEditor({ items, onChange, styled }: { items: ChromeItem[]; onChange: (next: ChromeItem[]) => void; styled?: boolean }) {
  const { t } = useTranslation();
  const patch = (i: number, p: Partial<ChromeItem>) => onChange(items.map((it, idx) => (idx === i ? { ...it, ...p } : it)));
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = items.slice();
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const add = () => { if (items.length < CHROME_ITEMS_MAX) onChange([...items, { labelRo: '', labelEn: '', href: '/' }]); };

  return (
    <div>
      {items.map((it, i) => (
        <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 6, padding: 8, marginBottom: 8, background: 'var(--bg-1)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Field label={t('admin.site.chrome.labelRo')} value={it.labelRo} maxLength={60} onChange={(v) => patch(i, { labelRo: v })} />
            <Field label={t('admin.site.chrome.labelEn')} value={it.labelEn} maxLength={60} onChange={(v) => patch(i, { labelEn: v })} />
          </div>
          <Field label={t('admin.site.chrome.href')} value={it.href} placeholder="/pachete" maxLength={200} onChange={(v) => patch(i, { href: v })} />
          {styled && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, alignItems: 'end', marginBottom: 6 }}>
              <label style={{ display: 'block' }}>
                <span style={labelStyle}>{t('admin.site.chrome.emphasis')}</span>
                <select style={selectStyle} value={it.emphasis || 'none'} onChange={(e) => patch(i, { emphasis: e.target.value as ChromeItem['emphasis'] })}>
                  {CHROME_EMPHASES.map((v) => <option key={v} value={v}>{t(`admin.site.chrome.emph_${v}`)}</option>)}
                </select>
              </label>
              <label style={{ display: 'block' }}>
                <span style={labelStyle}>{t('admin.site.chrome.anim')}</span>
                <select style={selectStyle} value={it.anim || 'none'} onChange={(e) => patch(i, { anim: e.target.value as ChromeItem['anim'] })}>
                  {CHROME_ANIMS.map((v) => <option key={v} value={v}>{t(`admin.site.chrome.anim_${v}`)}</option>)}
                </select>
              </label>
              <label style={{ display: 'block' }}>
                <span style={labelStyle}>{t('admin.site.chrome.color')}</span>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <input type="color" value={it.color || '#2e7fff'} onChange={(e) => patch(i, { color: e.target.value })} style={{ width: 34, height: 30, padding: 0, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-0)', cursor: 'pointer' }} />
                  {it.color ? <button type="button" className="btn" style={{ fontSize: 10, padding: '3px 6px' }} onClick={() => patch(i, { color: '' })}>{t('admin.site.chrome.colorAuto')}</button> : null}
                </div>
              </label>
            </div>
          )}
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" className="btn" style={{ fontSize: 11, padding: '3px 8px' }} disabled={i === 0} onClick={() => move(i, -1)}>{t('admin.site.chrome.moveUp')}</button>
            <button type="button" className="btn" style={{ fontSize: 11, padding: '3px 8px' }} disabled={i === items.length - 1} onClick={() => move(i, 1)}>{t('admin.site.chrome.moveDown')}</button>
            <button type="button" className="btn" style={{ fontSize: 11, padding: '3px 8px', marginLeft: 'auto', color: '#e06363' }} onClick={() => remove(i)}>{t('admin.site.chrome.remove')}</button>
          </div>
        </div>
      ))}
      <button type="button" className="btn" style={{ fontSize: 12, padding: '5px 12px' }} disabled={items.length >= CHROME_ITEMS_MAX} onClick={add}>
        {t('admin.site.chrome.addItem')}
      </button>
    </div>
  );
}

export default function ChromeEditor({ value, theme, onChange }: {
  value: SiteChrome; theme: CustomTheme; onChange: (c: SiteChrome) => void;
}) {
  const { t } = useTranslation();
  const [previewLang, setPreviewLang] = useState<'ro' | 'en'>('ro');
  const set = (patch: Partial<SiteChrome>) => onChange({ ...value, ...patch });

  const lang = previewLang;
  const lp = (href: string) => toLocalizedPath(internalHref(href), lang);
  const tagline = lang === 'en' ? value.taglineEn || value.taglineRo : value.taglineRo;
  const ctaLabel = lang === 'en' ? value.ctaLabelEn || value.ctaLabelRo : value.ctaLabelRo;
  const footerText = lang === 'en' ? value.footerTextEn || value.footerTextRo : value.footerTextRo;

  const card: CSSProperties = { background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 8, padding: 16 };
  const section: CSSProperties = { marginBottom: 16 };
  const h4: CSSProperties = { fontSize: 13, margin: '0 0 8px', color: 'var(--fg-0)' };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 380px) 1fr', gap: 20, alignItems: 'start' }}>
      {/* Câmpuri structurate */}
      <div style={card}>
        <section style={section}>
          <Field label={t('admin.site.chrome.brandName')} value={value.brandName} maxLength={40} onChange={(v) => set({ brandName: v })} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Field label={t('admin.site.chrome.taglineRo')} value={value.taglineRo} maxLength={120} onChange={(v) => set({ taglineRo: v })} />
            <Field label={t('admin.site.chrome.taglineEn')} value={value.taglineEn} maxLength={120} onChange={(v) => set({ taglineEn: v })} />
          </div>
        </section>

        <section style={section}>
          <h4 style={h4}>{t('admin.site.chrome.navTitle')}</h4>
          <p style={{ fontSize: 11, color: 'var(--fg-1)', margin: '0 0 8px' }}>{t('admin.site.chrome.navHint')}</p>
          <ItemListEditor items={value.nav} onChange={(nav) => set({ nav })} styled />
        </section>

        <section style={section}>
          <h4 style={h4}>{t('admin.site.chrome.ctaTitle')}</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Field label={t('admin.site.chrome.ctaLabelRo')} value={value.ctaLabelRo} maxLength={40} onChange={(v) => set({ ctaLabelRo: v })} />
            <Field label={t('admin.site.chrome.ctaLabelEn')} value={value.ctaLabelEn} maxLength={40} onChange={(v) => set({ ctaLabelEn: v })} />
          </div>
          <Field label={t('admin.site.chrome.ctaHref')} value={value.ctaHref} placeholder="/start" maxLength={200} onChange={(v) => set({ ctaHref: v })} />
        </section>

        <section style={section}>
          <h4 style={h4}>{t('admin.site.chrome.footerTitle')}</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Field label={t('admin.site.chrome.footerTextRo')} value={value.footerTextRo} maxLength={200} onChange={(v) => set({ footerTextRo: v })} />
            <Field label={t('admin.site.chrome.footerTextEn')} value={value.footerTextEn} maxLength={200} onChange={(v) => set({ footerTextEn: v })} />
          </div>
          <h4 style={{ ...h4, marginTop: 10 }}>{t('admin.site.chrome.footerLinksTitle')}</h4>
          <ItemListEditor items={value.footerLinks} onChange={(footerLinks) => set({ footerLinks })} />
        </section>
      </div>

      {/* Previzualizare header + footer pe tema publică, comutabilă RO/EN */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '0 0 8px' }}>
          <h3 style={{ fontSize: 14, margin: 0, color: 'var(--fg-1)' }}>{t('admin.site.chrome.previewTitle')}</h3>
          <span style={{ fontSize: 11, color: 'var(--fg-1)' }}>{t('admin.site.chrome.langPreview')}:</span>
          {(['ro', 'en'] as const).map((l) => (
            <button key={l} type="button" className={previewLang === l ? 'btn btn-primary' : 'btn'} style={{ fontSize: 11, padding: '3px 10px' }} onClick={() => setPreviewLang(l)}>
              {l.toUpperCase()}
            </button>
          ))}
        </div>
        <div style={{ ...customThemeStyle(theme), borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
          {/* Header */}
          <div style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-1)' }}>
            <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--fg-0)' }}>{value.brandName}</span>
              {tagline ? <span style={{ fontSize: 10, color: 'var(--fg-1)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>{tagline}</span> : null}
              <nav style={{ display: 'flex', gap: 14, alignItems: 'center', marginLeft: 'auto', flexWrap: 'wrap' }}>
                {value.nav.map((it, i) => {
                  const cls = chromeItemClass(it);
                  const stl: CSSProperties = cls
                    ? (it.color ? ({ ['--navcta-color']: it.color, fontSize: 13 } as CSSProperties) : { fontSize: 13 })
                    : { color: 'var(--fg-0)', fontSize: 13 };
                  return <span key={i} className={cls || undefined} title={lp(it.href)} style={stl}>{chromeLabel(it, lang)}</span>;
                })}
                {value.ctaHref && ctaLabel ? (
                  <span style={{ background: 'var(--accent)', color: 'var(--accent-contrast)', padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700 }}>{ctaLabel}</span>
                ) : null}
              </nav>
            </div>
          </div>
          {/* Corp fictiv */}
          <div style={{ padding: '28px 20px', minHeight: 90, color: 'var(--fg-1)', fontSize: 13 }}>
            <span style={{ opacity: 0.6 }}>— {t('admin.site.previewTitle')} —</span>
          </div>
          {/* Footer */}
          <div style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-1)' }}>
            <div style={{ padding: '16px 20px', display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', fontSize: 12, color: 'var(--fg-1)' }}>
              {footerText ? <span>{footerText}</span> : null}
              {value.footerLinks.map((it, i) => (
                <span key={i} title={lp(it.href)} style={{ color: 'var(--fg-1)' }}>{chromeLabel(it, lang)}</span>
              ))}
              <span style={{ marginLeft: 'auto', color: 'var(--fg-0)', fontWeight: 700, fontSize: 11, letterSpacing: 1 }}>{value.brandName.toUpperCase()}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
