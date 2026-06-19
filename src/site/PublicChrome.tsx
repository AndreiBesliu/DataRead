/**
 * Chrome-ul public (header/footer + meniu) pe paginile React — HIBRID, fără flash / fără hydration drift:
 * pornește SINCRON din snapshot-ul commit-uit (`PUBLIC_CHROME_DEFAULT` == prerender), apoi citește o dată
 * `siteConfig/publicChrome` din Firestore și suprascrie (self-serve, fără redeploy). Sub automatizare
 * (`navigator.webdriver`: prerender/boot) NU citește → snapshot determinist. Tipar identic cu usePublicTheme.
 */
import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { PUBLIC_CHROME_DEFAULT } from '../config/publicChrome';
import { coerceToSiteChrome, type SiteChrome } from '../types/siteChrome';

export function usePublicChrome(): SiteChrome {
  const [chrome, setChrome] = useState<SiteChrome>(PUBLIC_CHROME_DEFAULT);
  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.webdriver) return;
    let cancelled = false;
    getDoc(doc(db, 'siteConfig', 'publicChrome'))
      .then((snap) => { if (!cancelled) setChrome(coerceToSiteChrome(snap.exists() ? snap.data() : null).chrome); })
      .catch(() => {/* offline / interzis → rămâne snapshot-ul copt */});
    return () => { cancelled = true; };
  }, []);
  return chrome;
}
