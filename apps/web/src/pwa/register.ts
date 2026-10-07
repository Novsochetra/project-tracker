/// <reference types="vite-plugin-pwa/vanillajs" />
import { registerSW } from 'virtual:pwa-register';

if (import.meta.env.PROD) {
  registerSW({
    onRegisterError: (error: unknown) => {
      console.warn('Service worker registration failed', error);
    },
  });
}
