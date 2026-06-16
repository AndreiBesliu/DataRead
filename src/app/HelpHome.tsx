/**
 * Pagina de Ghid pentru client (/app/ghid) — schelet (titluri + subtitluri) al funcțiilor din portal.
 * Conținutul se completează incremental. Refolosește <HelpView> cu CLIENT_HELP.
 */
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import HelpView from '../help/HelpView';
import { CLIENT_HELP } from '../help/helpContent';

export default function HelpHome() {
  const { t } = useTranslation();
  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: '32px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <h1 style={{ fontSize: 24, margin: 0 }}>{t('help.title')}</h1>
        <Link to="/app" style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--accent, #2563eb)' }}>{t('help.backToApp')}</Link>
      </div>
      <HelpView sections={CLIENT_HELP} />
    </main>
  );
}
