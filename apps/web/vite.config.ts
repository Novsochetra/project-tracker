import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { savedAnswerPlugin } from './src/pwa/savedAnswerPlugin.ts';

const apiTarget = process.env.TRACKER_API_URL ?? 'http://localhost:4100';
const DAY_SECONDS = 24 * 60 * 60;

export default defineConfig({
  plugins: [
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
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api(?:\/|$)/],
        // The plugin only sets these for autoUpdate when it injects its own register script.
        skipWaiting: true,
        clientsClaim: true,
        // Workbox copies each urlPattern into sw.js as source text, so they must be self-contained.
        // Routes only match GET, so writes always go straight to the network.
        runtimeCaching: [
          {
            urlPattern: ({ url, sameOrigin }) =>
              sameOrigin && /^\/api\/attachments\/[^/]+\/file$/.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'attachments',
              cacheableResponse: { statuses: [200] },
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 30 * DAY_SECONDS,
                purgeOnQuotaError: true,
              },
            },
          },
          {
            // The SSE stream never ends, so caching it would buffer it forever.
            urlPattern: ({ url, request, sameOrigin }) =>
              sameOrigin &&
              url.pathname.startsWith('/api/') &&
              url.pathname !== '/api/events' &&
              !request.headers.get('accept')?.includes('text/event-stream'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api',
              networkTimeoutSeconds: 3,
              cacheableResponse: { statuses: [200] },
              expiration: { maxEntries: 100, maxAgeSeconds: 7 * DAY_SECONDS },
              // Last, so it marks only cached answers that are still fresh enough to use.
              plugins: [savedAnswerPlugin],
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': { target: apiTarget, changeOrigin: true },
    },
  },
});
