/// <reference types="vite-plugin-pwa/vanillajs" />
import { registerSW } from 'virtual:pwa-register';
import { registerOptions } from './registerOptions';
import { reloadOnPreloadError } from './reloadOnPreloadError';

const reload = () => window.location.reload();

if (import.meta.env.PROD) registerSW(registerOptions(reload));
reloadOnPreloadError(reload);
