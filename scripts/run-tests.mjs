// Runner de teste headless: împachetează fiecare scripts/test-*.ts cu esbuild și îl rulează sub
// Node. Iese non-zero dacă orice suite eșuează, deci CI (și `npm test`) blochează pe suite-urile
// de siguranță (normalisers, rutare i18n, pachete, entitlements, …).
// esbuild e mereu prezent (dependență a lui Vite) — importat aici fără dependență suplimentară.
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const DIR = 'scripts';
const files = readdirSync(DIR).filter((f) => /^test-.*\.ts$/.test(f)).sort();

if (files.length === 0) {
  console.error('No test-*.ts suites found in scripts/.');
  process.exit(1);
}

let failed = 0;
for (const f of files) {
  const out = join(DIR, `.tmp-${f.replace(/\.ts$/, '')}.cjs`);
  try {
    await build({
      entryPoints: [join(DIR, f)],
      bundle: true,
      platform: 'node',
      format: 'cjs',
      outfile: out,
      define: { 'import.meta.env': '{}' },
      logLevel: 'silent',
    });
    execFileSync(process.execPath, [out], { stdio: 'inherit' });
    console.log(`✓ ${f}`);
  } catch {
    failed++;
    console.error(`✗ ${f}`);
  } finally {
    rmSync(out, { force: true });
  }
}

console.log(`\n${files.length - failed}/${files.length} suites passed`);
process.exit(failed ? 1 : 0);
