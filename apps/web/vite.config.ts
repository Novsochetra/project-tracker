import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { precompress } from './src/build/precompress.ts';

const apiTarget = process.env.TRACKER_API_URL ?? 'http://localhost:4100';

// The dev server is a Node server with Node's five minutes for a whole request to arrive, so an
// upload sent slowly through its /api proxy failed with 408. It gets the hour the API gives
// uploads (apps/server/src/main.ts).
const DEV_REQUEST_TIMEOUT_MS = 60 * 60 * 1000;

const devUploadTimeout: Plugin = {
  name: 'tracker-dev-upload-timeout',
  configureServer(server) {
    const http = server.httpServer;
    if (http && 'requestTimeout' in http) http.requestTimeout = DEV_REQUEST_TIMEOUT_MS;
  },
};

export default defineConfig({
  plugins: [
    devUploadTimeout,
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        id: '/',
        name: 'Tracker',
        short_name: 'Tracker',
        description: 'Capture tickets on your phone and hand them to Claude Code.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: '#FFFFFF',
        background_color: '#FFFFFF',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        shortcuts: [
          {
            name: 'New ticket',
            short_name: 'New ticket',
            description: 'Capture a ticket in seconds',
            url: '/?capture',
            icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }],
          },
        ],
      },
      // Our own worker (src/pwa/sw.ts), for the push handlers; Workbox's parts are bundled into it,
      // so sw.js stays one file: a runtime in a file of its own, missing from a deploy, didn't fail
      // the install, and a worker with no handlers took over (PT-99).
      strategies: 'injectManifest',
      srcDir: 'src/pwa',
      filename: 'sw.ts',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,woff2}'],
        rollupFormat: 'iife',
      },
      devOptions: { enabled: false },
    }),
    precompress(),
  ],
  server: {
    host: true,
    port: 5173,
    proxy: {
      // xfwd says whose request it is (X-Forwarded-For): a tracker without an owner answers only
      // requests made on its own machine, and this server also takes them from the LAN.
      '/api': { target: apiTarget, changeOrigin: true, xfwd: true },
    },
  },
});
