import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { installGlobalErrorHandlers } from './services/errorReporting';
import './i18n'; // inițializează i18next (limbă din path + dicționare) înainte de render
import './styles.css';

// Identitatea build-ului la boot — un screenshot de consolă numește mereu deploy-ul exact.
// eslint-disable-next-line no-console
console.info(
  `[DataRead] v${typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev'}`,
  typeof __BUILD_HASH__ !== 'undefined' ? __BUILD_HASH__ : 'local',
  typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : ''
);

installGlobalErrorHandlers();

// createRoot (nu hydrateRoot) peste HTML-ul prerenderizat: paginile publice se randează
// determinist, deci înlocuirea e identică — fără complexitatea SSR.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
