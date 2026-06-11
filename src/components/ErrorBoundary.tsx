import { Component, type ErrorInfo, type ReactNode } from 'react';
import i18n from '../i18n';
import { reportError } from '../services/errorReporting';

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

/** Prinde erorile de render/lifecycle din subarbore: un crash arată un panou de recuperare în loc
 *  de ecran alb. Drafturile locale se salvează continuu, deci un reload recuperează aproape mereu. */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Un import de chunk eșuat înseamnă că index.html-ul sesiunii referă asseturi înlocuite de un
    // deploy mai nou (sau o rețea instabilă). Un reload automat aduce build-ul proaspăt — protejat
    // de sessionStorage ca un build cu adevărat stricat să nu intre în buclă.
    if (/dynamically imported module|importing a module script failed|failed to fetch.*module|loading chunk|preload css/i.test(error.message ?? '')) {
      try {
        if (!sessionStorage.getItem('dataread_chunk_reload')) {
          sessionStorage.setItem('dataread_chunk_reload', '1');
          window.location.reload();
          return;
        }
      } catch {
        /* private mode — cade pe panou */
      }
    }
    reportError(error, { componentStack: info.componentStack ?? undefined });
  }

  private reload = () => window.location.reload();

  /** Ultima scăpare: o valoare locală coruptă (preferințe, draft) poate crăpa fiecare lansare pe
   *  UN dispozitiv în timp ce celelalte merg. Șterge tot ce are prefixul dataread, apoi reîncarcă. */
  private reset = () => {
    if (!window.confirm(i18n.t('error.resetConfirm'))) return;
    try {
      const doomed: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('dataread')) doomed.push(k); // acoperă dataread. / dataread_ / dataread:
      }
      doomed.forEach((k) => localStorage.removeItem(k));
      sessionStorage.removeItem('dataread_chunk_reload');
    } catch {
      /* private mode */
    }
    window.location.reload();
  };

  render(): ReactNode {
    if (!this.state.error) return this.props.children;
    const t = i18n.t.bind(i18n);
    return (
      <div style={{ minHeight: '60vh', display: 'grid', placeItems: 'center', padding: 40 }}>
        <div style={{ maxWidth: 440, textAlign: 'center', background: 'var(--bg-1, #fff)', border: '1px solid var(--border, #ddd)', borderRadius: 10, padding: '28px 26px' }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--fg-0, #222)', marginBottom: 8 }}>{t('error.title')}</div>
          <div style={{ fontSize: 13, color: 'var(--fg-1, #555)', lineHeight: 1.5, marginBottom: 14 }}>{t('error.body')}</div>
          <div style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--fg-1, #666)', background: 'var(--bg-0, #f5f5f5)', border: '1px solid var(--border, #ddd)', borderRadius: 6, padding: '8px 10px', marginBottom: 16, textAlign: 'left', wordBreak: 'break-word' }}>
            {`${this.state.error.name || 'Error'}: ${this.state.error.message || ''}`.slice(0, 300)}
            <div style={{ marginTop: 4, opacity: 0.7 }}>
              {`v${typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev'} · ${typeof __BUILD_HASH__ !== 'undefined' ? __BUILD_HASH__ : 'local'}`}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={this.reload}>{t('error.reload')}</button>
            <button className="btn" onClick={this.reset}>{t('error.reset')}</button>
          </div>
        </div>
      </div>
    );
  }
}
