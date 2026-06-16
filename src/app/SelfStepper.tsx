/**
 * Stepper numerotat al funnel-ului „Self Marketing" (Profil → Oportunități → Strategie → Detalii → Execuție).
 * Pur prezentațional: pașii indisponibili (felii viitoare) apar marcați „în curând" și nu sunt selectabili.
 */
import { type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';

export interface SelfStep {
  key: string;
  labelKey: string;
  available: boolean;
}

export default function SelfStepper({ steps, current, onSelect }: { steps: SelfStep[]; current: number; onSelect: (i: number) => void }) {
  const { t } = useTranslation();

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
      {steps.map((s, i) => {
        const active = i === current;
        const clickable = s.available && !active;
        const dot: CSSProperties = {
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 22,
          height: 22,
          borderRadius: '50%',
          fontSize: 12,
          fontWeight: 700,
          background: active ? 'var(--accent)' : 'var(--bg-0)',
          color: active ? 'var(--accent-contrast)' : 'var(--fg-1)',
          border: active ? 'none' : '1px solid var(--border)',
        };
        return (
          <button
            key={s.key}
            type="button"
            disabled={!clickable}
            onClick={() => clickable && onSelect(i)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              border: active ? '1px solid var(--accent)' : '1px solid var(--border)',
              background: active ? 'rgba(37,99,235,0.08)' : 'var(--bg-1)',
              borderRadius: 999,
              padding: '6px 14px',
              fontSize: 13,
              fontWeight: active ? 700 : 600,
              color: s.available ? 'var(--fg-0)' : 'var(--fg-1)',
              cursor: clickable ? 'pointer' : 'default',
              opacity: s.available ? 1 : 0.6,
            }}
          >
            <span style={dot}>{i + 1}</span>
            {t(s.labelKey)}
            {!s.available && (
              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--fg-1)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                · {t('selfMarketing.soon')}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
