/// <reference types="vite-plugin-pwa/vanillajs" />
import { registerSW } from 'virtual:pwa-register';
import { reloadWhenSafe } from './reloadWhenSafe';

if (import.meta.env.PROD) {
  registerSW({
    // The plugin's own handler reloads straight away, even while the user is typing.
    onNeedReload: () => reloadWhenSafe(() => window.location.reload()),
    onRegisterError: (error: unknown) => {
      console.warn('Service worker registration failed', error);
    },
  });
}
