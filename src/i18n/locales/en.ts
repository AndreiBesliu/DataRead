import type ro from './ro';

/** English. Typed as `typeof ro` so it must mirror the Romanian keys exactly (ro is primary). */
const en: typeof ro = {
  app: {
    name: 'DataRead',
    tagline: 'The AI marketing platform for small and medium businesses',
  },
  notFound: {
    title: 'Page not found',
    back: 'Back to the homepage',
  },
  error: {
    title: 'Something went wrong.',
    body: 'Sorry — something failed. Reload the page; if the problem persists, press "Reset app data".',
    reload: 'Reload',
    reset: 'Reset app data',
    resetConfirm: 'Clear this device\'s local app data (preferences, drafts)? Your account and cloud data are NOT affected.',
  },
};

export default en;
