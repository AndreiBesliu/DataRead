/**
 * LP Editor — „IDE"-ul din /admin: editor de cod (textarea) + preview live (iframe izolat) + panou
 * de design (ThemeControls pe design-ul paginii). Bară meta: titlu, slug (blocat după creare = doc
 * ID), SEO, status/publicare, URL live. Salvează în landingPages/{slug}. Panoul AI (P3), formularul
 * (P5) și analytics (P5) se adaugă ca taburi suplimentare.
 */
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { customThemeCss } from '../theme/themes';
import ThemeControls from '../theme/ThemeControls';
import LpAiPanel from './LpAiPanel';
import LpFormConfigPanel from './LpFormConfig';
import LpAnalytics from './LpAnalytics';
import { sanitizeSlug, type LandingPage } from '../types/landingPage';

const ORIGIN = ((import.meta.env?.VITE_SITE_ORIGIN as string) || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '');

type EditorTab = 'code' | 'design' | 'ai' | 'form' | 'analytics';

function composeDoc(lp: LandingPage): string {
  return `<!doctype html><html lang="${lp.lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${customThemeCss(lp.design)}</style></head><body>${lp.html}</body></html>`;
}

export default function LpEditor({
  initial,
  docId,
  adminUid,
  existingSlugs,
  onClose,
  onSaved,
}: {
  initial: LandingPage;
  docId: string | null; // null = pagină nouă (slug încă neales)
  adminUid: string;
  existingSlugs: string[];
  onClose: () => void;
  onSaved: (slug: string) => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<LandingPage>(initial);
  const [tab, setTab] = useState<EditorTab>('code');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [err, setErr] = useState<string>('');
  const [previewDoc, setPreviewDoc] = useState<string>(() => composeDoc(initial));
  const [copied, setCopied] = useState(false);

  const isNew = docId === null;
  const slugTaken = isNew && !!draft.slug && existingSlugs.includes(draft.slug);

  // Preview debounced (nu recompun iframe-ul la fiecare tastă).
  useEffect(() => {
    const id = setTimeout(() => setPreviewDoc(composeDoc(draft)), 400);
    return () => clearTimeout(id);
  }, [draft.html, draft.design, draft.lang]);

  const setHtml = (html: string) => setDraft((d) => ({ ...d, html }));

  const payload = useMemo(
    () => ({
      schema: 1,
      slug: draft.slug,
      title: draft.title.slice(0, 140),
      seoDescription: draft.seoDescription.slice(0, 320),
      status: draft.status,
      lang: draft.lang,
      html: draft.html,
      design: draft.design,
      hasForm: draft.form.enabled,
      form: draft.form,
      clientUid: draft.clientUid,
      leadId: draft.leadId,
    }),
    [draft]
  );

  async function save(nextStatus?: LandingPage['status']) {
    setErr('');
    const status = nextStatus ?? draft.status;
    if (isNew) {
      if (!draft.slug) {
        setErr(t('admin.lpStudio.errNoSlug'));
        return;
      }
      if (existingSlugs.includes(draft.slug)) {
        setErr(t('admin.lpStudio.slugTaken'));
        return;
      }
    }
    if (status === 'published' && !draft.html.trim()) {
      setErr(t('admin.lpStudio.errNoHtml'));
      return;
    }
    setSaveState('saving');
    try {
      const id = isNew ? draft.slug : (docId as string);
      // Re-verifică unicitatea la creare (în caz că alt operator a creat între timp).
      if (isNew) {
        const snap = await getDoc(doc(db, 'landingPages', id));
        if (snap.exists()) {
          setErr(t('admin.lpStudio.slugTaken'));
          setSaveState('idle');
          return;
        }
        await setDoc(doc(db, 'landingPages', id), {
          ...payload,
          status,
          createdBy: adminUid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        await updateDoc(doc(db, 'landingPages', id), {
          ...payload,
          status,
          updatedAt: serverTimestamp(),
        });
      }
      setDraft((d) => ({ ...d, status }));
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 1500);
      onSaved(id);
    } catch (e) {
      setErr(String(e));
      setSaveState('idle');
    }
  }

  const liveUrl = draft.slug ? `${ORIGIN}/p/${draft.slug}` : '';
  const copyUrl = () => {
    if (!liveUrl) return;
    navigator.clipboard.writeText(liveUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const field: CSSProperties = { boxSizing: 'border-box', border: '1px solid var(--border)', borderRadius: 6, padding: '7px 9px', fontSize: 13, background: 'var(--bg-0)', color: 'var(--fg-0)' };
  const btn: CSSProperties = { border: '1px solid var(--border)', borderRadius: 8, padding: '7px 13px', fontSize: 13, fontWeight: 600, cursor: 'pointer', background: 'var(--bg-0)', color: 'var(--fg-0)' };
  const btnPrimary: CSSProperties = { ...btn, background: 'var(--accent)', color: 'var(--accent-contrast)', border: '1px solid var(--accent)' };
  const tabBtn = (active: boolean): CSSProperties => ({ border: 'none', background: 'none', padding: '6px 12px', fontSize: 14, fontWeight: active ? 800 : 600, color: active ? 'var(--accent)' : 'var(--fg-1)', borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent', cursor: 'pointer' });

  return (
    <div>
      {/* Bară meta */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        <button onClick={onClose} style={btn}>← {t('admin.lpStudio.back')}</button>
        <input
          value={draft.title}
          onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
          placeholder={t('admin.lpStudio.titlePlaceholder')}
          style={{ ...field, flex: 1, minWidth: 180, fontWeight: 700 }}
        />
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--fg-1)' }}>
          /p/
          <input
            value={draft.slug}
            disabled={!isNew}
            onChange={(e) => setDraft((d) => ({ ...d, slug: sanitizeSlug(e.target.value) }))}
            placeholder="slug"
            style={{ ...field, width: 160, opacity: isNew ? 1 : 0.6 }}
          />
        </span>
        <select value={draft.lang} onChange={(e) => setDraft((d) => ({ ...d, lang: e.target.value === 'en' ? 'en' : 'ro' }))} style={field}>
          <option value="ro">RO</option>
          <option value="en">EN</option>
        </select>
        <button onClick={() => save()} disabled={saveState === 'saving' || slugTaken} style={btn}>
          {saveState === 'saving' ? t('admin.lpStudio.saving') : saveState === 'saved' ? t('admin.lpStudio.saved') : t('admin.lpStudio.save')}
        </button>
        {draft.status === 'published' ? (
          <button onClick={() => save('draft')} style={btn}>{t('admin.lpStudio.unpublish')}</button>
        ) : (
          <button onClick={() => save('published')} style={btnPrimary}>{t('admin.lpStudio.publish')}</button>
        )}
        <span style={{ fontSize: 12, fontWeight: 700, color: draft.status === 'published' ? '#1e7e34' : 'var(--fg-1)' }}>
          {draft.status === 'published' ? t('admin.lpStudio.statusPublished') : t('admin.lpStudio.statusDraft')}
        </span>
      </div>

      {liveUrl && draft.status === 'published' ? (
        <div style={{ fontSize: 12, marginBottom: 10 }}>
          <a href={liveUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>{liveUrl}</a>
          <button onClick={copyUrl} style={{ ...btn, padding: '2px 8px', marginLeft: 8, fontSize: 11 }}>
            {copied ? t('admin.lpStudio.copied') : t('admin.lpStudio.copyUrl')}
          </button>
        </div>
      ) : null}

      {slugTaken ? <p style={{ color: '#c0392b', fontSize: 12, margin: '0 0 8px' }}>{t('admin.lpStudio.slugTaken')}</p> : null}
      {err ? <p style={{ color: '#c0392b', fontSize: 12, margin: '0 0 8px' }}>{err}</p> : null}

      {/* Bara de taburi */}
      <div style={{ display: 'flex', gap: 6, borderBottom: '2px solid var(--border)', marginBottom: 12, flexWrap: 'wrap' }}>
        <button onClick={() => setTab('code')} style={tabBtn(tab === 'code')}>{t('admin.lpStudio.tabCode')}</button>
        <button onClick={() => setTab('design')} style={tabBtn(tab === 'design')}>{t('admin.lpStudio.tabDesign')}</button>
        <button onClick={() => setTab('ai')} style={tabBtn(tab === 'ai')}>🤖 {t('admin.lpStudio.tabAi')}</button>
        <button onClick={() => setTab('form')} style={tabBtn(tab === 'form')}>{t('admin.lpStudio.tabForm')}</button>
        {!isNew ? <button onClick={() => setTab('analytics')} style={tabBtn(tab === 'analytics')}>📊 {t('admin.lpStudio.tabAnalytics')}</button> : null}
      </div>

      {tab === 'analytics' && !isNew ? (
        <LpAnalytics slug={docId as string} />
      ) : (
        <div style={{ display: 'flex', gap: 14, alignItems: 'stretch', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 420px', minWidth: 320 }}>
            {tab === 'code' && (
              <textarea
                value={draft.html}
                onChange={(e) => setHtml(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Tab') {
                    e.preventDefault();
                    const ta = e.currentTarget;
                    const s = ta.selectionStart;
                    const en = ta.selectionEnd;
                    setHtml(draft.html.slice(0, s) + '  ' + draft.html.slice(en));
                    requestAnimationFrame(() => {
                      ta.selectionStart = ta.selectionEnd = s + 2;
                    });
                  }
                }}
                spellCheck={false}
                placeholder={t('admin.lpStudio.codePlaceholder')}
                style={{ ...field, width: '100%', height: 460, resize: 'vertical', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', fontSize: 12.5, lineHeight: 1.5, whiteSpace: 'pre', overflowWrap: 'normal', tabSize: 2 }}
              />
            )}
            {tab === 'design' && (
              <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '4px 14px 16px', maxHeight: 460, overflowY: 'auto' }}>
                <ThemeControls value={draft.design} onChange={(design) => setDraft((d) => ({ ...d, design }))} withName={false} withAnimation={false} />
                <p style={{ fontSize: 11, color: 'var(--fg-1)', marginTop: 12 }}>{t('admin.lpStudio.designHint')}</p>
              </div>
            )}
            {tab === 'ai' && (
              <LpAiPanel
                html={draft.html}
                lang={draft.lang}
                onApply={(generated) => {
                  setHtml(generated);
                  setTab('code');
                }}
              />
            )}
            {tab === 'form' && (
              <LpFormConfigPanel value={draft.form} onChange={(form) => setDraft((d) => ({ ...d, form, hasForm: form.enabled }))} />
            )}
          </div>

          <div style={{ flex: '1 1 420px', minWidth: 320 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-1)', padding: '6px 0 12px' }}>{t('admin.lpStudio.preview')}</div>
            <iframe
              title="preview"
              srcDoc={previewDoc}
              sandbox="allow-forms allow-popups allow-scripts"
              referrerPolicy="no-referrer"
              style={{ width: '100%', height: 460, border: '1px solid var(--border)', borderRadius: 8, background: '#fff' }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
