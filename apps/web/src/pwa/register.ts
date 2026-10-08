/// <reference types="vite-plugin-pwa/vanillajs" />
import { registerSW } from 'virtual:pwa-register';
import { registerOptions } from './registerOptions';

if (import.meta.env.PROD) registerSW(registerOptions(() => window.location.reload()));
