/**
 * Agentul AI din LP Studio: generează o pagină nouă dintr-un brief sau modifică codul curent printr-o
 * instrucțiune în limbaj natural. Apelează callable-urile aiGenerateLandingPage / aiEditLandingPage
 * (admin-only, quota aiUsage); rezultatul {html} se aplică în editor (operatorul revizuiește + salvează).
 */
import { useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';

export default function LpAiPanel({
  html,
  lang,
  onApply,
}: {
  html: string;
  lang: 'ro' | 'en';
  onApply: (html: string) => void;
}) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'generate' | 'edit'>(html.trim() ? 'edit' : 'generate');
  const [offer, setOffer] = useState('');
  const [audience, setAudience] = useState('');
  const [goal, setGoal] = useState('');
  const [tone, setTone] = useState('');
  const [includeForm, setIncludeForm] = useState(false);
  const [instruction, setInstruction] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  function mapErr(e: unknown): string {
    const code = (e as { code?: string })?.code || '';
    if (code.includes('resource-exhausted')) return t('admin.lpStudio.aiQuota');
    if (code.includes('permission-denied') || code.includes('unauthenticated')) return t('admin.lpStudio.aiNotReady');
    if (code.includes('not-found') || code.includes('internal') || code.includes('unavailable')) return t('admin.lpStudio.aiNotReady');
    return t('admin.lpStudio.aiError');
  }

  async function generate() {
    if (!offer.trim()) {
      setErr(t('admin.lpStudio.aiOfferRequired'));
      return;
    }
    if (html.trim() && !window.confirm(t('admin.lpStudio.aiOverwriteConfirm'))) return;
    setErr('');
    setBusy(true);
    try {
      const fn = httpsCallable<{ brief: Record<string, unknown> }, { html: string }>(functions, 'aiGenerateLandingPage');
      const res = await fn({ brief: { offer, audience, goal, tone, includeForm, lang } });
      onApply(res.data.html || '');
    } catch (e) {
      setErr(mapErr(e));
    } finally {
      setBusy(false);
    }
  }

  async function edit() {
    if (!instruction.trim()) {
      setErr(t('admin.lpStudio.aiInstrRequired'));
      return;
    }
    setErr('');
    setBusy(true);
    try {
      const fn = httpsCallable<{ html: string; instruction: string; lang: string }, { html: string }>(functions, 'aiEditLandingPage');
      const res = await fn({ html, instruction, lang });
      onApply(res.data.html || '');
    } catch (e) {
      setErr(mapErr(e));
    } finally {
      setBusy(false);
    }
  }

  const field: CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1px solid var(--border)', borderRadius: 6, padding: '7px 9px', fontSize: 13, background: 'var(--bg-0)', color: 'var(--fg-0)', marginTop: 4 };
  const label: CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--fg-1)', marginTop: 12 };
  const btn: CSSProperties = { border: '1px solid var(--border)', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', background: 'var(--bg-0)', color: 'var(--fg-0)' };
  const btnPrimary: CSSProperties = { ...btn, background: 'var(--accent)', color: 'var(--accent-contrast)', border: '1px solid var(--accent)' };
  const modeBtn = (active: boolean): CSSProperties => ({ ...btn, padding: '5px 12px', background: active ? 'var(--accent)' : 'var(--bg-0)', color: active ? 'var(--accent-contrast)' : 'var(--fg-1)', border: active ? '1px solid var(--accent)' : '1px solid var(--border)' });

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '14px 16px', maxHeight: 460, overflowY: 'auto' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
        <button onClick={() => setMode('generate')} style={modeBtn(mode === 'generate')}>{t('admin.lpStudio.aiModeGenerate')}</button>
        <button onClick={() => setMode('edit')} disabled={!html.trim()} style={{ ...modeBtn(mode === 'edit'), opacity: html.trim() ? 1 : 0.5 }}>{t('admin.lpStudio.aiModeEdit')}</button>
      </div>

      {mode === 'generate' ? (
        <>
          <p style={{ fontSize: 12, color: 'var(--fg-1)', margin: '4px 0 0' }}>{t('admin.lpStudio.aiGenHint')}</p>
          <label style={label}>{t('admin.lpStudio.aiOffer')}</label>
          <textarea value={offer} onChange={(e) => setOffer(e.target.value)} maxLength={1000} style={{ ...field, minHeight: 56, resize: 'vertical', fontFamily: 'inherit' }} />
          <label style={label}>{t('admin.lpStudio.aiAudience')}</label>
          <input value={audience} onChange={(e) => setAudience(e.target.value)} maxLength={300} style={field} />
          <label style={label}>{t('admin.lpStudio.aiGoal')}</label>
          <input value={goal} onChange={(e) => setGoal(e.target.value)} maxLength={120} style={field} />
          <label style={label}>{t('admin.lpStudio.aiTone')}</label>
          <input value={tone} onChange={(e) => setTone(e.target.value)} maxLength={120} style={field} />
          <label style={{ ...label, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={includeForm} onChange={(e) => setIncludeForm(e.target.checked)} />
            {t('admin.lpStudio.aiIncludeForm')}
          </label>
          <button onClick={generate} disabled={busy} style={{ ...btnPrimary, marginTop: 16 }}>
            {busy ? t('admin.lpStudio.aiBusy') : t('admin.lpStudio.aiGenerate')}
          </button>
        </>
      ) : (
        <>
          <p style={{ fontSize: 12, color: 'var(--fg-1)', margin: '4px 0 0' }}>{t('admin.lpStudio.aiEditHint')}</p>
          <label style={label}>{t('admin.lpStudio.aiInstruction')}</label>
          <textarea value={instruction} onChange={(e) => setInstruction(e.target.value)} maxLength={2000} placeholder={t('admin.lpStudio.aiInstrPlaceholder')} style={{ ...field, minHeight: 90, resize: 'vertical', fontFamily: 'inherit' }} />
          <button onClick={edit} disabled={busy} style={{ ...btnPrimary, marginTop: 16 }}>
            {busy ? t('admin.lpStudio.aiBusy') : t('admin.lpStudio.aiEdit')}
          </button>
        </>
      )}

      {err ? <p style={{ color: '#c0392b', fontSize: 12, marginTop: 10 }}>{err}</p> : null}
    </div>
  );
}
