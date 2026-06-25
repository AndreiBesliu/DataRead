/**
 * Panou „Site" — administrarea site-ului public. Reorganizat pentru focus pe PAGINI + PREVIEW LIVE:
 *  1) Previzualizare LIVE a paginii reale (iframe pe ruta aleasă) — vezi efectul real, nu un card demo.
 *  2) Lista paginilor platformei (React, read-only) + „Deschide" + buton către sistemul de design.
 *  3) Sistemul de design (temă + header/footer) COLAPSAT implicit — ocupă spațiu doar când îl deschizi;
 *     editezi → „Salvează & publică" → preview-ul real se reîncarcă.
 *  4) Paginile de site editabile (LP Studio, kind:'site', servite la /pagina/{slug}).
 * Tema publică e în `siteConfig/publicTheme`, chrome-ul în `siteConfig/publicChrome` (aplicate hibrid pe site).
 */
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { coerceToCustomTheme, customThemeStyle, type CustomTheme } from '../theme/themes';
import ThemeControls from '../theme/ThemeControls';
import LandingStudio from './LandingStudio';
import ChromeEditor from './ChromeEditor';
import { PUBLIC_THEME_DEFAULT } from '../config/publicTheme';
import { SITE_PUBLIC_SCHEMA } from '../types/sitePublic';
import { PUBLIC_CHROME_DEFAULT } from '../config/publicChrome';
import { SITE_CHROME_SCHEMA, coerceToSiteChrome, type SiteChrome } from '../types/siteChrome';
import { PAGE_THEMES_SCHEMA, coerceToPageThemes, type PageKey } from '../types/pageThemes';

// Paginile platformei (rute React din App.tsx). Read-only aici: conținutul e în cod, ASPECTUL vine din sistemul de design.
const PLATFORM_PAGES = [
  { key: 'home', path: '/' },
  { key: 'pachete', path: '/pachete' },
  { key: 'servicii', path: '/servicii' },
  { key: 'self', path: '/self-marketing' },
  { key: 'start', path: '/start' },
  { key: 'contact', path: '/contact' },
  { key: 'termeni', path: '/legal/termeni' },
  { key: 'confid', path: '/legal/confidentialitate' },
  { key: 'app', path: '/app', ownTheme: true }, // portal autentificat — temă PROPRIE, nu cea publică
] as const;

export default function SiteAdminPanel({ adminUid }: { adminUid: string }) {
  const { t } = useTranslation();
  // `theme` = copia DE LUCRU a editorului (pt. scopul ales); `globalTheme` = tema publică globală încărcată;
  // `pageThemesMap` = override-urile per pagină; `scope` = pe ce se aplică editarea (global sau o pagină).
  const [theme, setTheme] = useState<CustomTheme>(PUBLIC_THEME_DEFAULT);
  const [globalTheme, setGlobalTheme] = useState<CustomTheme>(PUBLIC_THEME_DEFAULT);
  const [pageThemesMap, setPageThemesMap] = useState<Partial<Record<PageKey, CustomTheme>>>({});
  const [scope, setScope] = useState<'global' | PageKey>('global');
  const initRef = useRef(false); // init copia de lucru O SINGURĂ DATĂ (nu clobbera editările la snapshot-uri ulterioare)
  const chromeInitRef = useRef(false); // idem pt. chrome (ref, NU state — imun la stale-closure în listener cu deps [])
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'err'>('idle');
  const [chrome, setChrome] = useState<SiteChrome>(PUBLIC_CHROME_DEFAULT);
  const [chromeState, setChromeState] = useState<'idle' | 'saving' | 'saved' | 'err'>('idle');
  // Preview live + sistem de design colapsabil.
  const [previewPath, setPreviewPath] = useState<string>('/');
  const [previewKey, setPreviewKey] = useState(0); // bump → reîncarcă iframe-ul (după publicare)
  const [designOpen, setDesignOpen] = useState(false);
  const designRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return onSnapshot(
      doc(db, 'siteConfig', 'publicTheme'),
      (snap) => {
        const d = snap.exists() ? (snap.data() as Record<string, unknown>) : null;
        const g = d && 'theme' in d ? coerceToCustomTheme(d.theme) : PUBLIC_THEME_DEFAULT;
        setGlobalTheme(g);
        if (!initRef.current) { initRef.current = true; setTheme(g); } // editor pornește pe global (scope implicit)
      },
      () => { /* offline → rămâne default */ },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return onSnapshot(
      doc(db, 'siteConfig', 'pageThemes'),
      (snap) => setPageThemesMap(coerceToPageThemes(snap.exists() ? snap.data() : null).themes),
      () => setPageThemesMap({}),
    );
  }, []);

  useEffect(() => {
    return onSnapshot(
      doc(db, 'siteConfig', 'publicChrome'),
      (snap) => {
        if (!chromeInitRef.current) {
          chromeInitRef.current = true; // ref, NU state: deps [] face callback-ul să capteze stale chromeLoaded → guard inutil
          setChrome(coerceToSiteChrome(snap.exists() ? snap.data() : null).chrome);
        }
      },
      () => {
        chromeInitRef.current = true;
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reloadPreview = () => setPreviewKey((k) => k + 1);

  // Schimbă scopul de editare (global / o pagină). Încarcă în editor tema scopului (override-ul paginii sau,
  // dacă pagina n-are, tema globală ca punct de plecare) + sincronizează preview-ul cu pagina aleasă.
  const changeScope = (s: 'global' | PageKey) => {
    setScope(s);
    setTheme(s === 'global' ? globalTheme : (pageThemesMap[s] || globalTheme));
    if (s !== 'global') { const p = PLATFORM_PAGES.find((x) => x.key === s); if (p) setPreviewPath(p.path); }
  };

  const publish = async () => {
    setState('saving');
    try {
      if (scope === 'global') {
        await setDoc(doc(db, 'siteConfig', 'publicTheme'), {
          schema: SITE_PUBLIC_SCHEMA, theme: coerceToCustomTheme(theme), updatedAt: serverTimestamp(), updatedBy: adminUid,
        });
      } else {
        const themes = { ...pageThemesMap, [scope]: coerceToCustomTheme(theme) };
        await setDoc(doc(db, 'siteConfig', 'pageThemes'), {
          schema: PAGE_THEMES_SCHEMA, themes, updatedAt: serverTimestamp(), updatedBy: adminUid,
        });
      }
      setState('saved');
      reloadPreview(); // tema publicată → arată-o pe pagina reală
      setTimeout(() => setState('idle'), 2500);
    } catch (e) {
      console.warn('publish theme failed:', e);
      setState('err');
    }
  };

  // Șterge override-ul paginii curente → pagina cade înapoi pe tema globală.
  const resetPageTheme = async () => {
    if (scope === 'global') return;
    setState('saving');
    try {
      const themes = { ...pageThemesMap };
      delete themes[scope];
      await setDoc(doc(db, 'siteConfig', 'pageThemes'), {
        schema: PAGE_THEMES_SCHEMA, themes, updatedAt: serverTimestamp(), updatedBy: adminUid,
      });
      setTheme(globalTheme);
      setState('saved');
      reloadPreview();
      setTimeout(() => setState('idle'), 2500);
    } catch (e) {
      console.warn('reset page theme failed:', e);
      setState('err');
    }
  };

  const publishChrome = async () => {
    setChromeState('saving');
    try {
      await setDoc(doc(db, 'siteConfig', 'publicChrome'), {
        schema: SITE_CHROME_SCHEMA,
        chrome: coerceToSiteChrome({ chrome }).chrome,
        updatedAt: serverTimestamp(),
        updatedBy: adminUid,
      });
      setChromeState('saved');
      reloadPreview();
      setTimeout(() => setChromeState('idle'), 2500);
    } catch (e) {
      console.warn('publish public chrome failed:', e);
      setChromeState('err');
    }
  };

  const openDesign = () => {
    // Deschide designul cu scopul = pagina previzualizată acum (editezi exact ce vezi); altfel rămâne scopul curent.
    const p = PLATFORM_PAGES.find((x) => x.path === previewPath);
    if (p) changeScope(p.key);
    setDesignOpen(true);
    setTimeout(() => designRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  // Editează designul UNEI pagini anume (din lista de pagini): setează scopul + deschide editorul.
  const editPageDesign = (key: PageKey) => {
    changeScope(key);
    setDesignOpen(true);
    setTimeout(() => designRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  const card: CSSProperties = { background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 8, padding: 16 };
  const linkBtn: CSSProperties = { border: '1px solid var(--border)', background: 'var(--bg-0)', borderRadius: 7, padding: '4px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: 'var(--fg-0)', textDecoration: 'none' };
  const td: CSSProperties = { padding: '8px 10px', borderBottom: '1px solid var(--border)', fontSize: 13, textAlign: 'left' };

  return (
    <div style={{ marginTop: 12 }}>
      <h2 style={{ fontSize: 18, margin: '0 0 4px' }}>{t('admin.site.title')}</h2>
      <p style={{ fontSize: 13, color: 'var(--fg-1)', margin: '0 0 16px' }}>{t('admin.site.intro')}</p>

      {/* 1) Previzualizare LIVE a paginii reale (iframe). Reflectă tema/chrome PUBLICATE; se reîncarcă după publicare. */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
          <h3 style={{ fontSize: 14, margin: 0 }}>{t('admin.site.previewLive')}</h3>
          <label style={{ fontSize: 12, color: 'var(--fg-1)', display: 'flex', alignItems: 'center', gap: 6 }}>
            {t('admin.site.previewOf')}
            <select value={previewPath} onChange={(e) => setPreviewPath(e.target.value)} style={{ ...linkBtn, padding: '4px 8px', cursor: 'pointer' }}>
              {PLATFORM_PAGES.map((p) => <option key={p.key} value={p.path}>{t(`admin.site.pg_${p.key}`)} ({p.path})</option>)}
            </select>
          </label>
          <button type="button" onClick={reloadPreview} style={linkBtn}>↻ {t('admin.site.reloadPreview')}</button>
          <a href={previewPath} target="_blank" rel="noreferrer" style={linkBtn}>{t('admin.site.openTab')} ↗</a>
        </div>
        {/* `?preview=1` → modul preview al aplicației: /app randează un shell tematizat (FĂRĂ login) și side-effect-urile
            Firebase Auth sunt sărite, deci iframe-ul (același origin = aceeași sesiune) NU mai scoate operatorul la login.
            `sandbox` FĂRĂ allow-top-navigation → pagina din iframe nu poate naviga fereastra /admin. Schimbarea paginii doar
            actualizează `src` (fără remount); re-montarea se face DOAR prin `key={previewKey}` la „Reîncarcă"/după publicare. */}
        <iframe
          key={previewKey}
          src={`${previewPath}${previewPath.includes('?') ? '&' : '?'}preview=1`}
          title={t('admin.site.previewLive')}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
          style={{ width: '100%', height: 560, border: '1px solid var(--border)', borderRadius: 10, background: '#fff' }}
        />
      </div>

      {/* 2) Pagini platformă (read-only) + acces la sistemul de design. */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
          <h3 style={{ fontSize: 14, margin: 0 }}>{t('admin.site.platformTitle')}</h3>
          <button type="button" className="btn" onClick={openDesign} style={{ marginLeft: 'auto', padding: '5px 12px', fontSize: 12 }}>{t('admin.site.editDesign')}</button>
        </div>
        <p style={{ fontSize: 12, color: 'var(--fg-1)', margin: '0 0 8px' }}>{t('admin.site.platformHint')}</p>
        <div style={{ ...card, padding: 0, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {PLATFORM_PAGES.map((p) => (
                <tr key={p.key} style={{ background: previewPath === p.path ? 'var(--bg-0)' : 'transparent' }}>
                  <td style={{ ...td, fontWeight: 700 }}>
                    {t(`admin.site.pg_${p.key}`)}
                    {'ownTheme' in p && p.ownTheme && (
                      <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3, borderRadius: 4, padding: '1px 7px', background: '#fff4e5', color: '#b25e09' }}>{t('admin.site.ownTheme')}</span>
                    )}
                  </td>
                  <td style={{ ...td, color: 'var(--fg-1)', fontFamily: 'monospace', fontSize: 12 }}>{p.path}</td>
                  <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button type="button" onClick={() => editPageDesign(p.key)} style={{ ...linkBtn, marginRight: 6 }}>🎨 {t('admin.site.designBtn')}</button>
                    <button type="button" onClick={() => setPreviewPath(p.path)} style={{ ...linkBtn, marginRight: 6 }}>{t('admin.site.preview')}</button>
                    <a href={p.path} target="_blank" rel="noreferrer" style={linkBtn}>{t('admin.site.openTab')} ↗</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3) Sistem de design — COLAPSAT implicit (temă + header/footer). */}
      <div ref={designRef} style={{ marginBottom: 8, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
        <button
          type="button"
          onClick={() => setDesignOpen((v) => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--fg-0)', fontSize: 16, fontWeight: 800 }}
        >
          <span style={{ color: 'var(--accent, #2563eb)' }}>{designOpen ? '▾' : '▸'}</span> {t('admin.site.designToggle')}
        </button>
        <p style={{ fontSize: 12, color: 'var(--fg-1)', margin: '4px 0 0' }}>{t('admin.site.designToggleHint')}</p>

        {designOpen && (
          <div style={{ marginTop: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 360px) 1fr', gap: 20, alignItems: 'start' }}>
              {/* Editor temă — PER SCOP (global SAU o pagină). */}
              <div style={card}>
                <h3 style={{ fontSize: 14, margin: '0 0 8px' }}>{t('admin.site.designTitle')}</h3>
                <label style={{ display: 'grid', gap: 4, fontSize: 12, fontWeight: 700, marginBottom: 12 }}>
                  {t('admin.site.scopeLabel')}
                  <select value={scope} onChange={(e) => changeScope(e.target.value as 'global' | PageKey)} style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, background: 'var(--bg-0)', color: 'var(--fg-0)' }}>
                    <option value="global">{t('admin.site.scopeGlobal')}</option>
                    {PLATFORM_PAGES.map((p) => <option key={p.key} value={p.key}>{t(`admin.site.pg_${p.key}`)}{pageThemesMap[p.key] ? ' •' : ''}</option>)}
                  </select>
                </label>
                <ThemeControls value={theme} onChange={setTheme} withName={false} withFonts withAnimation={false} />
                <button className="btn btn-primary" disabled={state === 'saving'} onClick={() => void publish()} style={{ marginTop: 16, padding: '9px 18px', fontSize: 14 }}>
                  {state === 'saving' ? t('admin.site.publishing') : state === 'saved' ? t('admin.site.published') : (scope === 'global' ? t('admin.site.publish') : t('admin.site.publishPage'))}
                </button>
                {scope !== 'global' && pageThemesMap[scope] && (
                  <button type="button" disabled={state === 'saving'} onClick={() => void resetPageTheme()} style={{ marginTop: 8, marginLeft: 8, ...linkBtn }}>{t('admin.site.resetToGlobal')}</button>
                )}
                {state === 'err' && <p role="alert" style={{ color: 'var(--danger)', fontSize: 12, marginTop: 8 }}>{t('admin.site.publishErr')}</p>}
                <p style={{ fontSize: 11, color: 'var(--fg-1)', marginTop: 8 }}>{scope === 'global' ? t('admin.site.publishHint') : t('admin.site.publishPageHint')}</p>
              </div>

              {/* Preview instant pe card demo (efectul editărilor NEpublicate — iframe-ul de sus arată ce e PUBLICAT). */}
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

            {/* Header & Footer global */}
            <div style={{ marginTop: 28, borderTop: '1px solid var(--border)', paddingTop: 18 }}>
              <h3 style={{ fontSize: 16, margin: '0 0 4px' }}>{t('admin.site.chrome.title')}</h3>
              <p style={{ fontSize: 13, color: 'var(--fg-1)', margin: '0 0 16px' }}>{t('admin.site.chrome.intro')}</p>
              <ChromeEditor value={chrome} theme={theme} onChange={setChrome} />
              <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <button className="btn btn-primary" disabled={chromeState === 'saving'} onClick={() => void publishChrome()} style={{ padding: '9px 18px', fontSize: 14 }}>
                  {chromeState === 'saving' ? t('admin.site.publishing') : chromeState === 'saved' ? t('admin.site.published') : t('admin.site.publish')}
                </button>
                {/* Reîncarcă meniul/header-ul IMPLICIT al platformei (include paginile noi, ex. „Servicii"). Util când
                    un meniu publicat mai demult e în urma codului — apoi „Salvează & publică" îl scrie în site. */}
                <button type="button" className="btn" disabled={chromeState === 'saving'} onClick={() => setChrome(PUBLIC_CHROME_DEFAULT)} style={{ padding: '9px 14px', fontSize: 13 }}>
                  {t('admin.site.chrome.restoreDefault')}
                </button>
                {chromeState === 'err' && <span role="alert" style={{ color: 'var(--danger)', fontSize: 12 }}>{t('admin.site.publishErr')}</span>}
                <span style={{ fontSize: 11, color: 'var(--fg-1)' }}>{t('admin.site.chrome.restoreDefaultHint')}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4) Pagini de site editabile (CMS pe LP Studio) — servite la /pagina/{slug}, temate cu tema publică. */}
      <div style={{ marginTop: 28, borderTop: '1px solid var(--border)', paddingTop: 18 }}>
        <LandingStudio adminUid={adminUid} kind="site" />
      </div>
    </div>
  );
}
