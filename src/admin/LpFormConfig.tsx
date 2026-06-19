/**
 * Configurarea formularului opțional al unei Landing Page. Operatorul alege per LP dacă pagina are
 * formular și ce câmpuri. Submit-urile sunt captate de funcția submitLpForm (vezi serveLp /p/_submit).
 */
import { type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { LP_FIELD_TYPES, LP_FORM_FIELDS_MAX, LP_FORM_STEPS_MAX, type LpFieldType, type LpFormConfig } from '../types/landingPage';

export default function LpFormConfigPanel({ value, onChange }: { value: LpFormConfig; onChange: (f: LpFormConfig) => void }) {
  const { t } = useTranslation();

  const field: CSSProperties = { boxSizing: 'border-box', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 8px', fontSize: 13, background: 'var(--bg-0)', color: 'var(--fg-0)' };
  const label: CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--fg-1)', marginTop: 12 };
  const btn: CSSProperties = { border: '1px solid var(--border)', borderRadius: 8, padding: '6px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer', background: 'var(--bg-0)', color: 'var(--fg-0)' };

  const setField = (i: number, patch: Partial<LpFormConfig['fields'][number]>) =>
    onChange({ ...value, fields: value.fields.map((f, idx) => (idx === i ? { ...f, ...patch } : f)) });
  const addField = () => {
    if (value.fields.length >= LP_FORM_FIELDS_MAX) return;
    onChange({ ...value, fields: [...value.fields, { name: '', label: '', type: 'text', required: false, options: [], step: 0 }] });
  };
  const removeField = (i: number) => onChange({ ...value, fields: value.fields.filter((_, idx) => idx !== i) });

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '4px 14px 16px', maxHeight: 460, overflowY: 'auto' }}>
      <label style={{ ...label, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
        <input type="checkbox" checked={value.enabled} onChange={(e) => onChange({ ...value, enabled: e.target.checked })} />
        {t('admin.lpStudio.formEnabled')}
      </label>

      {value.enabled ? (
        <>
          <label style={{ ...label, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={value.multiStep} onChange={(e) => onChange({ ...value, multiStep: e.target.checked })} />
            {t('admin.lpStudio.formMultiStep')}
          </label>
          {value.multiStep ? <div style={{ fontSize: 11, color: 'var(--fg-1)' }}>{t('admin.lpStudio.formMultiStepHint')}</div> : null}
          <div style={{ fontSize: 12, color: 'var(--fg-1)', marginTop: 10 }}>{t('admin.lpStudio.formHint')}</div>
          {value.fields.map((f, i) => (
            <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10, marginTop: 10, display: 'grid', gap: 6 }}>
              <div style={{ display: 'flex', gap: 6 }}>
                <input value={f.label} onChange={(e) => setField(i, { label: e.target.value })} placeholder={t('admin.lpStudio.fieldLabel')} style={{ ...field, flex: 1 }} />
                <input value={f.name} onChange={(e) => setField(i, { name: e.target.value.toLowerCase().replace(/[^a-z0-9_]+/g, '_').slice(0, 40) })} placeholder="name" style={{ ...field, width: 120, fontFamily: 'monospace' }} />
                <button onClick={() => removeField(i)} style={{ ...btn, padding: '4px 9px', color: '#c0392b' }}>✕</button>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <select value={f.type} onChange={(e) => setField(i, { type: e.target.value as LpFieldType })} style={field}>
                  {LP_FIELD_TYPES.map((tp) => <option key={tp} value={tp}>{t(`admin.lpStudio.ft_${tp}`)}</option>)}
                </select>
                <label style={{ fontSize: 12, color: 'var(--fg-1)', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input type="checkbox" checked={f.required} onChange={(e) => setField(i, { required: e.target.checked })} />
                  {t('admin.lpStudio.fieldRequired')}
                </label>
                {f.type === 'select' || f.type === 'radio' ? (
                  <input
                    value={f.options.join(', ')}
                    onChange={(e) => setField(i, { options: e.target.value.split(',').map((o) => o.trim()).filter(Boolean).slice(0, 20) })}
                    placeholder={t('admin.lpStudio.fieldOptions')}
                    style={{ ...field, flex: 1, minWidth: 160 }}
                  />
                ) : null}
                {value.multiStep ? (
                  <label style={{ fontSize: 12, color: 'var(--fg-1)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    {t('admin.lpStudio.fieldStep')}
                    <select value={f.step ?? 0} onChange={(e) => setField(i, { step: Number(e.target.value) })} style={field}>
                      {Array.from({ length: LP_FORM_STEPS_MAX }, (_, s) => <option key={s} value={s}>{s + 1}</option>)}
                    </select>
                  </label>
                ) : null}
              </div>
            </div>
          ))}
          {value.fields.length < LP_FORM_FIELDS_MAX ? (
            <button onClick={addField} style={{ ...btn, marginTop: 10 }}>+ {t('admin.lpStudio.formAddField')}</button>
          ) : null}

          <label style={label}>{t('admin.lpStudio.submitLabel')}</label>
          <input value={value.submitLabel} onChange={(e) => onChange({ ...value, submitLabel: e.target.value })} maxLength={40} style={{ ...field, width: '100%' }} />
          <label style={label}>{t('admin.lpStudio.successMessage')}</label>
          <input value={value.successMessage} onChange={(e) => onChange({ ...value, successMessage: e.target.value })} maxLength={300} style={{ ...field, width: '100%' }} />
          <label style={label}>{t('admin.lpStudio.redirectUrl')}</label>
          <input
            value={value.redirectUrl}
            onChange={(e) => onChange({ ...value, redirectUrl: e.target.value.trim() })}
            placeholder="https://…"
            maxLength={500}
            style={{ ...field, width: '100%' }}
          />
          <div style={{ fontSize: 11, color: 'var(--fg-1)', marginTop: 4 }}>{t('admin.lpStudio.redirectUrlHint')}</div>
          <label style={{ ...label, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={value.createLead} onChange={(e) => onChange({ ...value, createLead: e.target.checked })} />
            {t('admin.lpStudio.createLead')}
          </label>
          <div style={{ fontSize: 11, color: 'var(--fg-1)', marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
            🛡️ {t('admin.lpStudio.honeypotNote')}
          </div>
        </>
      ) : null}
    </div>
  );
}
