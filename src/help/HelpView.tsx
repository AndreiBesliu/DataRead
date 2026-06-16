/**
 * Randare schelet pentru Ghid — refolosită în /admin (tab) și /app (pagina /app/ghid). Afișează
 * titlul fiecărei secțiuni + subtitlurile; sub fiecare subtitlu, corpul (când există `bodyKey`) sau
 * un placeholder discret „în curând". Pur prezentațional (primește secțiunile, fără date/listeneri).
 */
import { type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import type { HelpSection } from './helpContent';

export default function HelpView({ sections }: { sections: HelpSection[] }) {
  const { t } = useTranslation();

  const sectionBox: CSSProperties = { background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px 18px', marginBottom: 16 };
  const itemBox: CSSProperties = { borderTop: '1px solid var(--border)', padding: '10px 0 2px' };

  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--fg-1)', margin: '0 0 18px' }}>{t('help.subtitle')}</p>
      {sections.map((s) => (
        <section key={s.id} style={sectionBox}>
          <h3 style={{ fontSize: 16, margin: '0 0 4px' }}>{t(s.titleKey)}</h3>
          {s.items.map((it) => (
            <div key={it.titleKey} style={itemBox}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{t(it.titleKey)}</div>
              <div style={{ fontSize: 13, color: 'var(--fg-1)', whiteSpace: 'pre-wrap', marginTop: 2 }}>
                {it.bodyKey ? t(it.bodyKey) : <em style={{ opacity: 0.7 }}>{t('help.soon')}</em>}
              </div>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
