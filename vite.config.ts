import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

// App version inlined at build time (shown in the error panel / boot console line).
const pkgVersion = JSON.parse(readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8')).version;
// Exact build identity — lets a crash report / console screenshot name the precise deploy,
// which is also enough to regenerate this build's sourcemaps from git when needed.
let gitHash = 'local';
try { gitHash = execSync('git rev-parse --short HEAD', { cwd: __dirname }).toString().trim(); } catch { /* no git */ }
const buildTime = new Date().toISOString();

export default defineConfig({
  plugins: [react()],
  // Absolute base — REQUIRED: public routes are prerendered at nested paths (/pachete/, /en/...),
  // where a relative './' base would resolve assets against the wrong directory.
  base: '/',
  define: {
    __APP_VERSION__: JSON.stringify(pkgVersion),
    __BUILD_HASH__: JSON.stringify(gitHash),
    __BUILD_TIME__: JSON.stringify(buildTime),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Maps without the sourceMappingURL pointer: kept locally for debugging the deployed build,
    // excluded from the Hosting upload (firebase.json ignore).
    sourcemap: 'hidden',
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Pin Vite's __vitePreload helper to the always-loaded react-vendor chunk so it never
          // drags an arbitrary vendor chunk onto the first-paint path.
          if (id.includes('vite/preload-helper')) return 'react-vendor';
          if (!id.includes('node_modules')) return;
          if (id.includes('firebase')) return 'firebase';
          if (id.includes('i18next')) return 'i18n';
          if (id.includes('/react') || id.includes('scheduler') || id.includes('zustand')) return 'react-vendor';
        },
      },
    },
  },
});
