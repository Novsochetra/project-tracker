import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const apiTarget = process.env.TRACKER_API_URL ?? 'http://localhost:4100';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': { target: apiTarget, changeOrigin: true },
    },
  },
});
