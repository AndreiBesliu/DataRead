/**
 * Panoul de previzualizare al LP — mare, cu fundal distinct (canvas în damă) față de admin, lățimi de
 * dispozitiv (mobil/tabletă/desktop) ca să testezi responsive-ul, și redimensionabil pe verticală.
 * Conținutul (iframe) ține cont de lățimea aleasă, deci se vede comportamentul responsive real.
 */
import { useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';

const DEVICES = [
  { id: 'mobile', w: 390, icon: '📱' },
  { id: 'tablet', w: 820, icon: '💻' },
  { id: 'desktop', w: 0, icon: '🖥️' },
] as const;
type DeviceId = (typeof DEVICES)[number]['id'];

export default function LpPreviewPane({ srcDoc }: { srcDoc: string }) {
  const { t } = useTranslation();
  const [device, setDevice] = useState<DeviceId>('desktop');
  const dev = DEVICES.find((d) => d.id === device) || DEVICES[2];

  const tabBtn = (active: boolean): CSSProperties => ({
    border: active ? '1px solid var(--accent)' : '1px solid var(--border)',
    background: active ? 'var(--accent)' : 'var(--bg-0)',
    color: active ? 'var(--accent-contrast)' : 'var(--fg-1)',
    borderRadius: 7,
    padding: '4px 9px',
    fontSize: 14,
    cursor: 'pointer',
    lineHeight: 1,
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0 10px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-1)' }}>{t('admin.lpStudio.preview')}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          {DEVICES.map((d) => (
            <button key={d.id} onClick={() => setDevice(d.id)} title={t(`admin.lpStudio.pv_${d.id}`)} style={tabBtn(device === d.id)}>
              {d.icon}
            </button>
          ))}
        </div>
        <span style={{ fontSize: 11, color: 'var(--fg-1)', minWidth: 60, textAlign: 'right' }}>
          {dev.w ? `${dev.w}px` : t('admin.lpStudio.pv_full')}
        </span>
      </div>

      {/* Suprafața-canvas: fundal distinct (damă), redimensionabilă pe verticală. */}
      <div
        className="lp-preview-surface"
        style={{ height: 640, minHeight: 320, resize: 'vertical', overflow: 'auto', borderRadius: 10, padding: 14, display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}
      >
        <iframe
          title="preview"
          srcDoc={srcDoc}
          sandbox="allow-forms allow-popups allow-scripts"
          referrerPolicy="no-referrer"
          style={{
            width: dev.w ? `${dev.w}px` : '100%',
            maxWidth: '100%',
            height: '100%',
            minHeight: 580,
            border: 'none',
            borderRadius: dev.w ? 10 : 6,
            background: '#fff',
            boxShadow: dev.w ? '0 8px 30px rgba(0,0,0,0.4)' : '0 2px 10px rgba(0,0,0,0.25)',
            flex: '0 0 auto',
          }}
        />
      </div>
      <p style={{ fontSize: 11, color: 'var(--fg-1)', marginTop: 8 }}>{t('admin.lpStudio.pv_resizeHint')}</p>
    </div>
  );
}
