/**
 * Editorul de CONȚINUT al unei pagini (Felia B) — operatorul rescrie textele paginilor publice fără deploy.
 *
 * Pentru fiecare cheie din registrul `EDITABLE_CONTENT` arată textul IMPLICIT (din locale, NU din `t()` —
 * store-ul i18next e deja suprascris de override-uri) lângă un câmp de override. Gol = revenire la implicit.
 *
 * ANTI-CLOBBER: componenta NU ține o copie a documentului, ci doar cheile ATINSE în sesiune (`dirty`,
 * unde '' = revenire la implicit). La publicare, `dirty` se aplică peste CEL MAI RECENT snapshot din
 * Firestore ⇒ editările altui operator (altă pagină sau altă cheie) supraviețuiesc.
 */
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Button } from '../ui/Button';
import { defaultText } from '../i18n/contentOverride';
import { EDITABLE_CONTENT, editableKeysForPage } from '../config/editablePageContent';
import { PAGE_CONTENT_DEFAULT } from '../config/pageContentSnapshot';
import type { PageKey } from '../types/pageThemes';
import {
  CONTENT_LANGS,
  EMPTY_PAGE_CONTENT,
  MAX_CONTENT_VALUE_LEN,
  PAGE_CONTENT_SCHEMA,
  coerceToPageContent,
  contentFitsLimits,
  missingVars,
  pendingSnapshotKeys,
  setContentValue,
  type ContentLang,
  type PageContent,
} from '../types/pageContent';

const DOC_ID = 'pageContent';
type Dirty = Record<ContentLang, Record<string, string>>;
const NO_DIRTY: Dirty = { ro: {}, en: {} };

export default function PageContentEditor({ adminUid, page, onPublished }: {
  adminUid: string;
  page: PageKey;
  onPublished?: () => void;
}) {
  const { t } = useTranslation();
  const [lang, setLang] = useState<ContentLang>('ro');
  const [published, setPublished] = useState<PageContent>(EMPTY_PAGE_CONTENT);
  const [dirty, setDirty] = useState<Dirty>(NO_DIRTY);
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'err'>('idle');
  const [limitErr, setLimitErr] = useState<'keys' | 'bytes' | null>(null);

  useEffect(() => {
    return onSnapshot(
      doc(db, 'siteConfig', DOC_ID),
      (snap) => setPublished(coerceToPageContent(snap.exists() ? snap.data() : null)),
      () => { /* offline → rămâne ce avem; publicarea va reîncerca */ },
    );
  }, []);

  // Grupurile derivate din config (ex. „Ce NU include") pot ieși goale dacă sursa nu are intrări — le sărim.
  const groups = (EDITABLE_CONTENT[page] || []).filter((g) => g.keys.length > 0);
  const pageKeys = useMemo(() => editableKeysForPage(page), [page]);

  /** Valoarea afișată = ce a scris operatorul acum (dacă a atins cheia), altfel ce e publicat. */
  const valueOf = (l: ContentLang, key: string) =>
    key in dirty[l] ? dirty[l][key] : published.content[l][key] || '';
  const setValue = (key: string, value: string) =>
    setDirty((d) => ({ ...d, [lang]: { ...d[lang], [key]: value } }));

  const hasChanges = CONTENT_LANGS.some((l) => Object.keys(dirty[l]).length > 0);
  const editedCount = useMemo(
    () => pageKeys.filter((k) => CONTENT_LANGS.some((l) => valueOf(l, k).trim() !== '')).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dirty, published, pageKeys]
  );
  // Texte PUBLICATE care încă nu sunt în snapshotul copt → se văd la vizitatori, dar nu în HTML-ul
  // prerandat (crawlere). Facem decalajul vizibil în loc să-l lăsăm tăcut.
  const pendingSeo = useMemo(() => {
    const p = pendingSnapshotKeys(published, coerceToPageContent(PAGE_CONTENT_DEFAULT));
    const set = new Set(pageKeys);
    return CONTENT_LANGS.reduce((n, l) => n + p[l].filter((k) => set.has(k)).length, 0);
  }, [published, pageKeys]);

  /** Revenire la implicit pentru TOATE cheile paginii, în ambele limbi (aplicată la publicare). */
  const resetPage = () => {
    if (!window.confirm(t('admin.site.content.resetPageConfirm'))) return;
    setDirty((d) => {
      const next: Dirty = { ro: { ...d.ro }, en: { ...d.en } };
      for (const l of CONTENT_LANGS) for (const k of pageKeys) next[l][k] = '';
      return next;
    });
  };

  const publish = async () => {
    setState('saving');
    setLimitErr(null);
    try {
      // Bază = ULTIMUL snapshot remote; scriem DOAR cheile atinse ⇒ nu clobberăm alt operator.
      let merged = published;
      for (const l of CONTENT_LANGS) {
        for (const [k, v] of Object.entries(dirty[l])) merged = setContentValue(merged, l, k, v);
      }
      const fit = contentFitsLimits(merged);
      if (!fit.ok) { setLimitErr(fit.reason || 'bytes'); setState('idle'); return; }
      await setDoc(doc(db, 'siteConfig', DOC_ID), {
        schema: PAGE_CONTENT_SCHEMA,
        content: merged.content,
        updatedAt: serverTimestamp(),
        updatedBy: adminUid,
      });
      setDirty(NO_DIRTY); // onSnapshot aduce versiunea scrisă; ciorna nu mai are ce adăuga
      setState('saved');
      onPublished?.();
      setTimeout(() => setState('idle'), 2500);
    } catch (e) {
      console.warn('publish page content failed:', e);
      setState('err');
    }
  };

  const card: CSSProperties = { background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 8, padding: 14 };
  const inputStyle: CSSProperties = {
    width: '100%', padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 6,
    fontSize: 13, background: 'var(--bg-0)', color: 'var(--fg-0)', fontFamily: 'inherit',
  };
  const pill = (active: boolean): CSSProperties => ({
    border: '1px solid var(--border)', borderRadius: 'var(--radius-pill, 999px)', padding: '3px 12px',
    fontSize: 12, fontWeight: 700, cursor: 'pointer',
    background: active ? 'var(--accent)' : 'var(--bg-0)', color: active ? 'var(--accent-contrast)' : 'var(--fg-0)',
  });

  if (groups.length === 0) return <p style={{ fontSize: 12, color: 'var(--fg-1)' }}>{t('admin.site.content.noKeys')}</p>;

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, fontWeight: 700 }}>{t('admin.site.content.lang')}</span>
        {CONTENT_LANGS.map((l) => (
          <button key={l} type="button" onClick={() => setLang(l)} style={pill(lang === l)} aria-pressed={lang === l}>
            {l.toUpperCase()}
          </button>
        ))}
        <span style={{ fontSize: 11, color: 'var(--fg-1)', marginLeft: 'auto' }}>
          {t('admin.site.content.count', { n: editedCount })}
        </span>
      </div>

      {pendingSeo > 0 && (
        <p style={{ fontSize: 12, color: 'var(--warn, #b25e09)', background: 'var(--warn-soft, #fff4e5)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 10px', margin: 0 }}>
          ⓘ {t('admin.site.content.pendingSeo', { n: pendingSeo })}
        </p>
      )}

      {groups.map((g) => (
        <div key={`${g.titleKey}:${g.keys[0].key}`} style={card}>
          <h4 style={{ fontSize: 13, margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--fg-1)' }}>
            {t(g.titleKey)}
          </h4>
          <div style={{ display: 'grid', gap: 12 }}>
            {g.keys.map(({ key, multiline }) => {
              const def = defaultText(lang, key);
              const value = valueOf(lang, key);
              const lost = value ? missingVars(def, value) : [];
              const enLooksRo = lang === 'en' && value !== '' && value === defaultText('ro', key);
              return (
                <div key={key}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
                    <code style={{ fontSize: 10, color: 'var(--fg-1)', fontFamily: 'monospace' }}>{key}</code>
                    {value !== '' && (
                      <button type="button" onClick={() => setValue(key, '')} style={{ ...pill(false), padding: '1px 8px', fontSize: 10 }}>
                        ↺ {t('admin.site.content.reset')}
                      </button>
                    )}
                    {value.length > MAX_CONTENT_VALUE_LEN * 0.8 && (
                      <span style={{ fontSize: 10, color: 'var(--fg-1)' }}>{value.length}/{MAX_CONTENT_VALUE_LEN}</span>
                    )}
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--fg-1)', margin: '0 0 4px', whiteSpace: 'pre-wrap' }}>
                    <span style={{ fontWeight: 700 }}>{t('admin.site.content.defaultLabel')}</span> {def || '—'}
                  </p>
                  {multiline ? (
                    <textarea
                      value={value}
                      onChange={(e) => setValue(key, e.target.value)}
                      rows={3}
                      placeholder={def}
                      aria-label={key}
                      maxLength={MAX_CONTENT_VALUE_LEN}
                      style={{ ...inputStyle, resize: 'vertical' }}
                    />
                  ) : (
                    <input
                      value={value}
                      onChange={(e) => setValue(key, e.target.value)}
                      placeholder={def}
                      aria-label={key}
                      maxLength={MAX_CONTENT_VALUE_LEN}
                      style={inputStyle}
                    />
                  )}
                  {lost.length > 0 && (
                    <p role="alert" style={{ fontSize: 11, color: 'var(--warn, #b25e09)', margin: '3px 0 0' }}>
                      ⚠ {t('admin.site.content.varsMissing', { vars: lost.map((v) => `{{${v}}}`).join(', ') })}
                    </p>
                  )}
                  {enLooksRo && (
                    <p style={{ fontSize: 11, color: 'var(--warn, #b25e09)', margin: '3px 0 0' }}>
                      ⚠ {t('admin.site.content.enLooksRo')}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Button variant="primary" disabled={state === 'saving' || !hasChanges} onClick={() => void publish()}>
          {state === 'saving' ? t('admin.site.publishing') : state === 'saved' ? t('admin.site.published') : t('admin.site.content.publish')}
        </Button>
        {editedCount > 0 && <Button size="sm" onClick={resetPage} disabled={state === 'saving'}>{t('admin.site.content.resetPage')}</Button>}
        {hasChanges && <span style={{ fontSize: 11, color: 'var(--fg-1)' }}>{t('admin.site.content.unsaved')}</span>}
        {limitErr && <span role="alert" style={{ color: 'var(--danger)', fontSize: 12 }}>{t('admin.site.content.tooBig')}</span>}
        {state === 'err' && <span role="alert" style={{ color: 'var(--danger)', fontSize: 12 }}>{t('admin.site.publishErr')}</span>}
      </div>
      <p style={{ fontSize: 11, color: 'var(--fg-1)', margin: 0 }}>{t('admin.site.content.hint')}</p>
    </div>
  );
}
