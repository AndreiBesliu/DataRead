/**
 * Selector de șabloane LP — afișat la „Pagină nouă". Carduri cu mini-preview live (iframe) pentru
 * fiecare șablon + opțiunea „Pagină goală". Alegerea construiește o LandingPage editabilă.
 */
import { useMemo, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { compilePageDecors, emptyLandingPage, type LandingPage } from '../types/landingPage';
import { compileBlocks } from '../types/lpBlocks';
import { customThemeCss } from '../theme/themes';
import { LP_TEMPLATES, landingPageFromTemplate, type LpTemplate } from './lpTemplates';

function thumbDoc(lp: LandingPage): string {
  const body = compileBlocks(lp.blocks, { form: lp.form });
  const decor = compilePageDecors(lp.pageDecors);
  // viewport lat → randare „desktop" pe care o micșorăm vizual în card (transform: scale)
  return `<!doctype html><html lang="${lp.lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=1100,initial-scale=1"><style>${customThemeCss(lp.design)}</style></head><body>${decor}${body}</body></html>`;
}

function Thumb({ tpl }: { tpl: LpTemplate }) {
  const doc = useMemo(() => thumbDoc(landingPageFromTemplate(tpl, '')), [tpl]);
  // iframe randat la 1100px lățime, scalat la lățimea cardului (~0.24), clipat.
  return (
    <div style={{ width: '100%', height: 180, overflow: 'hidden', borderRadius: 8, border: '1px solid var(--border)', position: 'relative', background: '#fff' }}>
      <iframe
        title={tpl.id}
        srcDoc={doc}
        sandbox="allow-scripts"
        scrolling="no"
        style={{ width: 1100, height: 760, border: 'none', transform: 'scale(0.245)', transformOrigin: 'top left', pointerEvents: 'none' }}
      />
    </div>
  );
}

export default function LpTemplatePicker({ adminUid, onPick, onClose }: { adminUid: string; onPick: (initial: LandingPage) => void; onClose: () => void }) {
  const { t } = useTranslation();

  const overlay: CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '32px 16px', zIndex: 60, overflowY: 'auto' };
  const panel: CSSProperties = { width: '100%', maxWidth: 1000, background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, color: 'var(--fg-0)', boxShadow: '0 18px 50px rgba(0,0,0,0.5)' };
  const card: CSSProperties = { border: '1px solid var(--border)', borderRadius: 10, padding: 10, background: 'var(--bg-0)', cursor: 'pointer', textAlign: 'left' };
  const btn: CSSProperties = { border: '1px solid var(--border)', borderRadius: 8, padding: '6px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer', background: 'var(--bg-0)', color: 'var(--fg-0)' };

  return (
    <div style={overlay} onClick={onClose}>
      <div style={panel} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <h2 style={{ fontSize: 18, margin: 0 }}>{t('admin.lpStudio.tpl_title')}</h2>
          <button onClick={onClose} style={{ ...btn, marginLeft: 'auto' }}>{t('admin.lpStudio.ff_done')}</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
          {/* Pagină goală */}
          <button onClick={() => onPick(emptyLandingPage(adminUid))} style={card}>
            <div style={{ width: '100%', height: 180, borderRadius: 8, border: '1px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--fg-1)', fontSize: 32 }}>+</div>
            <div style={{ fontWeight: 700, marginTop: 8, color: 'var(--fg-0)' }}>{t('admin.lpStudio.tpl_blank')}</div>
            <div style={{ fontSize: 12, color: 'var(--fg-1)' }}>{t('admin.lpStudio.tpl_blankHint')}</div>
          </button>

          {LP_TEMPLATES.map((tpl) => (
            <button key={tpl.id} onClick={() => onPick(landingPageFromTemplate(tpl, adminUid))} style={card}>
              <Thumb tpl={tpl} />
              <div style={{ fontWeight: 700, marginTop: 8, color: 'var(--fg-0)' }}>{tpl.name}</div>
              <div style={{ fontSize: 12, color: 'var(--fg-1)' }}>{tpl.category}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
