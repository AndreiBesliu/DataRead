import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { pathLanguage, stripLangPrefix, toLocalizedPath } from '../i18n/routing';
import { SITE_ORIGIN } from '../config/site';

/** Setează <title>, meta description, canonical, hreflang (ro ↔ en, x-default=ro) și og:* pentru
 *  pagina curentă — fără dependență de helmet. Tagurile gestionate poartă data-seo ca să fie
 *  înlocuite curat la navigare. Prerender-ul capturează HTML-ul DUPĂ rularea acestui effect. */

function upsertMeta(attr: 'name' | 'property', key: string, content: string): void {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function removeMeta(attr: 'name' | 'property', key: string): void {
  document.head.querySelector(`meta[${attr}="${key}"]`)?.remove();
}

function setManagedLinks(links: Array<{ rel: string; href: string; hreflang?: string }>): void {
  document.head.querySelectorAll('link[data-seo]').forEach((el) => el.remove());
  for (const l of links) {
    const el = document.createElement('link');
    el.setAttribute('rel', l.rel);
    el.setAttribute('href', l.href);
    if (l.hreflang) el.setAttribute('hreflang', l.hreflang);
    el.setAttribute('data-seo', '1');
    document.head.appendChild(el);
  }
}

interface Props {
  titleKey: string;
  descriptionKey: string;
  noindex?: boolean;
}

export default function Seo({ titleKey, descriptionKey, noindex }: Props) {
  const { t, i18n } = useTranslation();
  const { pathname } = useLocation();

  useEffect(() => {
    const lang = pathLanguage(pathname);
    const slug = stripLangPrefix(pathname);
    const url = (l: 'ro' | 'en') => SITE_ORIGIN + toLocalizedPath(slug, l);

    document.title = t(titleKey);
    document.documentElement.lang = lang;
    upsertMeta('name', 'description', t(descriptionKey));
    upsertMeta('property', 'og:title', t(titleKey));
    upsertMeta('property', 'og:description', t(descriptionKey));
    upsertMeta('property', 'og:url', url(lang));
    upsertMeta('property', 'og:type', 'website');

    if (noindex) {
      upsertMeta('name', 'robots', 'noindex');
      setManagedLinks([{ rel: 'canonical', href: url(lang) }]);
    } else {
      removeMeta('name', 'robots');
      setManagedLinks([
        { rel: 'canonical', href: url(lang) },
        { rel: 'alternate', href: url('ro'), hreflang: 'ro' },
        { rel: 'alternate', href: url('en'), hreflang: 'en' },
        { rel: 'alternate', href: url('ro'), hreflang: 'x-default' },
      ]);
    }
  }, [pathname, titleKey, descriptionKey, noindex, t, i18n.language]);

  return null;
}
