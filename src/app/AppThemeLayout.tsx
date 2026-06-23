import { Outlet } from 'react-router-dom';
import { customThemeStyle } from '../theme/themes';
import { useAppPageTheme } from './appPageTheme';

/** Layout pentru TOATE rutele /app/* — aplică tema portalului (pageThemes.app) O SINGURĂ DATĂ pe un wrapper,
 *  prin <Outlet/>, ca paginile imbricate (/, /onboarding, /self-marketing, /ghid) să fie consistente cu /app.
 *  Lipsă override → fără temă (aspectul default neschimbat). minHeight: 100vh ca fundalul temei să umple ecranul. */
export default function AppThemeLayout() {
  const theme = useAppPageTheme();
  return (
    <div style={theme ? { ...customThemeStyle(theme), minHeight: '100vh' } : undefined}>
      <Outlet />
    </div>
  );
}
