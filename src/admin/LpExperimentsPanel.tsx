/**
 * Panou „A/B testing" din LP Editor (#60, felia 5). Operatorul definește experimente = sloturi cu 2+ variante.
 * Workflow: (1) adaugă în pagină un bloc „Experiment A/B" cu un expId; (2) aici definește variantele acelui
 * experiment (conținut per variantă prin builder-ul de blocuri reutilizat) + pondere + status. serveLp împarte
 * traficul sticky și măsoară (vezi panoul de rezultate din Analytics). Modelul/coerce: src/types/landingPage.ts.
 */
import { useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import LpVisualBuilder from './LpVisualBuilder';
import { LP_ARMS_MAX, LP_ARMS_MIN, LP_EXPERIMENTS_MAX, LP_EXP_STATUSES, type LpExperiment, type LpExpArm, type LpFormConfig } from '../types/landingPage';

const sanitizeId = (v: string, max: number) => v.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+/, '').slice(0, max);
const nextArmId = (arms: LpExpArm[]): string => {
  for (const c of 'abcdefghijk') if (!arms.some((a) => a.id === c)) return c;
  return 'a' + arms.length;
};

export default function LpExperimentsPanel({ value, form, onChange, onAddSlot }: {
  value: LpExperiment[];
  form: LpFormConfig;
  onChange: (exps: LpExperiment[]) => void;
  onAddSlot: (expId: string) => boolean; // întoarce false dacă slotul există deja
}) {
  const { t } = useTranslation();
  const [editArm, setEditArm] = useState<string>(''); // `${expId}:${armId}` deschis pentru editarea conținutului

  const field: CSSProperties = { boxSizing: 'border-box', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 8px', fontSize: 13, background: 'var(--bg-0)', color: 'var(--fg-0)' };
  const label: CSSProperties = { display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--fg-1)', margin: '8px 0 3px' };
  const btn: CSSProperties = { border: '1px solid var(--border)', borderRadius: 7, padding: '5px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', background: 'var(--bg-0)', color: 'var(--fg-0)' };
  const card: CSSProperties = { border: '1px solid var(--border)', borderRadius: 10, padding: 12, marginTop: 12, background: 'var(--bg-1)' };

  const setExp = (i: number, patch: Partial<LpExperiment>) => onChange(value.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  const setArm = (ei: number, ai: number, patch: Partial<LpExpArm>) =>
    setExp(ei, { arms: value[ei].arms.map((a, idx) => (idx === ai ? { ...a, ...patch } : a)) });

  const addExperiment = () => {
    if (value.length >= LP_EXPERIMENTS_MAX) return;
    let id = 'exp' + (value.length + 1);
    while (value.some((e) => e.id === id)) id += '1';
    onChange([...value, { id, name: '', status: 'off', minSample: 200, winnerArm: '', arms: [
      { id: 'a', label: 'Control', weight: 50, blocks: [] },
      { id: 'b', label: 'Variantă B', weight: 50, blocks: [] },
    ] }]);
  };
  const removeExperiment = (i: number) => onChange(value.filter((_, idx) => idx !== i));
  const addArm = (ei: number) => {
    const e = value[ei];
    if (e.arms.length >= LP_ARMS_MAX) return;
    const ctrl = e.arms[0];
    const id = nextArmId(e.arms);
    // „Clonează control ca variantă": copiază blocurile controlului ca punct de plecare.
    const blocks = JSON.parse(JSON.stringify(ctrl ? ctrl.blocks : []));
    setExp(ei, { arms: [...e.arms, { id, label: 'Variantă ' + id.toUpperCase(), weight: 50, blocks }] });
  };
  const removeArm = (ei: number, ai: number) => {
    const e = value[ei];
    if (e.arms.length <= LP_ARMS_MIN) return;
    setExp(ei, { arms: e.arms.filter((_, idx) => idx !== ai), winnerArm: '' });
  };

  return (
    <div style={{ maxHeight: 520, overflowY: 'auto', paddingRight: 4 }}>
      <p style={{ fontSize: 12, color: 'var(--fg-1)', margin: '0 0 4px' }}>{t('admin.lpStudio.abIntro')}</p>

      {value.map((exp, ei) => (
        <div key={ei} style={card}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input value={exp.name} placeholder={t('admin.lpStudio.abName')} maxLength={60} onChange={(e) => setExp(ei, { name: e.target.value })} style={{ ...field, flex: 1, minWidth: 140, fontWeight: 700 }} />
            <select value={exp.status} onChange={(e) => setExp(ei, { status: e.target.value as LpExperiment['status'] })} style={field}>
              {LP_EXP_STATUSES.map((s) => <option key={s} value={s}>{t('admin.lpStudio.abStatus_' + s)}</option>)}
            </select>
            <button onClick={() => removeExperiment(ei)} style={{ ...btn, color: '#c0392b' }}>✕</button>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 6 }}>
            <label style={{ fontSize: 11, color: 'var(--fg-1)', display: 'flex', gap: 4, alignItems: 'center' }}>
              expId
              <input value={exp.id} maxLength={24} onChange={(e) => setExp(ei, { id: sanitizeId(e.target.value, 24) })} style={{ ...field, width: 120, fontFamily: 'monospace' }} />
            </label>
            <label style={{ fontSize: 11, color: 'var(--fg-1)', display: 'flex', gap: 4, alignItems: 'center' }}>
              {t('admin.lpStudio.abMinSample')}
              <input type="number" min={30} value={exp.minSample} onChange={(e) => setExp(ei, { minSample: Number(e.target.value) || 200 })} style={{ ...field, width: 90 }} />
            </label>
            <button onClick={() => { if (!onAddSlot(exp.id)) alert(t('admin.lpStudio.abSlotExists')); }} style={btn}>{t('admin.lpStudio.abAddSlot')}</button>
          </div>
          {exp.winnerArm ? <div style={{ fontSize: 12, color: '#1e7e34', marginTop: 6 }}>⭐ {t('admin.lpStudio.abPromoted', { arm: exp.winnerArm })}</div> : null}

          <div style={{ marginTop: 8 }}>
            {exp.arms.map((arm, ai) => {
              const key = exp.id + ':' + arm.id;
              const open = editArm === key;
              return (
                <div key={ai} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 8, marginTop: 8 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent)', minWidth: 18 }}>{arm.id.toUpperCase()}</span>
                    <input value={arm.label} placeholder={t('admin.lpStudio.abArmLabel')} maxLength={40} onChange={(e) => setArm(ei, ai, { label: e.target.value })} style={{ ...field, flex: 1, minWidth: 100 }} />
                    <label style={{ fontSize: 11, color: 'var(--fg-1)', display: 'flex', gap: 4, alignItems: 'center' }}>
                      {t('admin.lpStudio.abWeight')}
                      <input type="number" min={1} max={100} value={arm.weight} onChange={(e) => setArm(ei, ai, { weight: Math.min(Math.max(Number(e.target.value) || 1, 1), 100) })} style={{ ...field, width: 64 }} />
                    </label>
                    <button onClick={() => setEditArm(open ? '' : key)} style={btn}>{open ? t('admin.lpStudio.abHideContent') : t('admin.lpStudio.abEditContent')}</button>
                    {exp.arms.length > LP_ARMS_MIN ? <button onClick={() => removeArm(ei, ai)} style={{ ...btn, color: '#c0392b' }}>✕</button> : null}
                  </div>
                  {open ? (
                    <div style={{ marginTop: 8, borderTop: '1px dashed var(--border)', paddingTop: 8 }}>
                      <LpVisualBuilder blocks={arm.blocks} form={form} onChange={(blocks) => setArm(ei, ai, { blocks })} />
                    </div>
                  ) : null}
                </div>
              );
            })}
            {exp.arms.length < LP_ARMS_MAX ? <button onClick={() => addArm(ei)} style={{ ...btn, marginTop: 8 }}>+ {t('admin.lpStudio.abAddArm')}</button> : null}
          </div>
        </div>
      ))}

      {value.length < LP_EXPERIMENTS_MAX ? <button onClick={addExperiment} style={{ ...btn, marginTop: 12 }}>+ {t('admin.lpStudio.abAddExperiment')}</button> : null}
    </div>
  );
}
