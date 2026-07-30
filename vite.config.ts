/// <reference types="vitest" />

import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const proxyTarget = env.VITE_API_PROXY_TARGET || env.VITE_API_DISPLAY_URL || 'http://localhost:8081';

  // Build revision is injected at build time, never read from the running browser environment.
  // It is bounded on purpose: a short revision string and nothing else.
  const appRevision = (env.VITE_APP_REVISION || '').trim().slice(0, 40);

  return {
    define: {
      __APP_REVISION__: JSON.stringify(appRevision),
    },
    plugins: [react()],
    server: {
      host: '0.0.0.0',
      port: 5173,
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
        },
        '/health': {
          target: proxyTarget,
          changeOrigin: true,
        },
      },
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      restoreMocks: true,
      clearMocks: true,
    },
  };
});
