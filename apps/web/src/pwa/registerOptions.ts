import type { RegisterSWOptions } from 'vite-plugin-pwa/types';
import { checkForUpdates } from './checkForUpdates';
import { reloadWhenSafe } from './reloadWhenSafe';

export function registerOptions(reload: () => void): RegisterSWOptions {
  return {
    // The plugin's own handler reloads straight away, even while the user is typing.
    onNeedReload: () => reloadWhenSafe(reload),
    onRegisteredSW: (_url, registration) => {
      if (registration) checkForUpdates(registration);
    },
    onRegisterError: (error: unknown) => {
      console.warn('Service worker registration failed', error);
    },
  };
}
