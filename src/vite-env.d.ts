/// <reference types="vite/client" />

// Build identity injected by vite.config.ts `define` — see ErrorBoundary / main.tsx.
declare const __APP_VERSION__: string;
declare const __BUILD_HASH__: string;
declare const __BUILD_TIME__: string;
