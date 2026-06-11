// Suite headless: rutarea de limbă (path → limbă) — regula prerender-safe.
// Rulat de scripts/run-tests.mjs (esbuild + Node, fără framework de teste).
import {
  resolveInitialLanguage,
  toLocalizedPath,
  stripLangPrefix,
  pathLanguage,
  isAppPath,
} from '../src/i18n/routing';

let failures = 0;
function check(name: string, ok: boolean): void {
  if (ok) console.log(`  ✓ ${name}`);
  else {
    failures++;
    console.error(`  ✗ ${name}`);
  }
}

// Rutele publice: limba vine STRICT din path, indiferent de storage.
check("'/' → ro", resolveInitialLanguage('/', null) === 'ro');
check("'/pachete' → ro chiar cu stored 'en'", resolveInitialLanguage('/pachete', 'en') === 'ro');
check("'/en' → en", resolveInitialLanguage('/en', null) === 'en');
check("'/en/pachete' → en chiar cu stored 'ro'", resolveInitialLanguage('/en/pachete', 'ro') === 'en');
check("'/enx' NU e prefix en → ro", pathLanguage('/enx') === 'ro');
check("'/legal/termeni' → ro", resolveInitialLanguage('/legal/termeni', 'en') === 'ro');

// Zonele de aplicație: limba vine din storage (doar valori valide), fallback ro.
check("'/app' + stored 'en' → en", resolveInitialLanguage('/app', 'en') === 'en');
check("'/app' fără stored → ro", resolveInitialLanguage('/app', null) === 'ro');
check("'/app' + stored invalid → ro", resolveInitialLanguage('/app', 'de') === 'ro');
check("'/admin/x' e app path", isAppPath('/admin/x'));
check("'/application' NU e app path", !isAppPath('/application'));

// Construirea și desfacerea path-urilor localizate.
check("toLocalizedPath('/', en) = '/en'", toLocalizedPath('/', 'en') === '/en');
check("toLocalizedPath('/pachete', en) = '/en/pachete'", toLocalizedPath('/pachete', 'en') === '/en/pachete');
check("toLocalizedPath('/pachete', ro) = '/pachete'", toLocalizedPath('/pachete', 'ro') === '/pachete');
check("toLocalizedPath('contact', en) normalizează slash-ul", toLocalizedPath('contact', 'en') === '/en/contact');
check("stripLangPrefix('/en/pachete') = '/pachete'", stripLangPrefix('/en/pachete') === '/pachete');
check("stripLangPrefix('/en') = '/'", stripLangPrefix('/en') === '/');
check("stripLangPrefix('/pachete') neschimbat", stripLangPrefix('/pachete') === '/pachete');
check('round-trip en', stripLangPrefix(toLocalizedPath('/contact', 'en')) === '/contact');
check('round-trip ro', stripLangPrefix(toLocalizedPath('/contact', 'ro')) === '/contact');

if (failures) {
  console.error(`${failures} checks failed`);
  process.exit(1);
}
console.log('i18n routing: all checks passed');
