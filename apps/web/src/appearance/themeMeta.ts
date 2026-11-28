import type { Appearance } from './resolveAppearance';

// The browser's bars and the iPhone's status bar take the page's color (--page in tokens.css,
// which test/regression/appearance-first-paint keeps them equal to). Not black-translucent: it
// forces white status-bar text, invisible over the light nav bar.
export const THEME_COLORS: Record<Appearance, string> = { light: '#ffffff', dark: '#000000' };
export const STATUS_BAR_STYLES: Record<Appearance, string> = { light: 'default', dark: 'black' };

function setMeta(document: Document, name: string, content: string): void {
  document.querySelector(`meta[name="${name}"]`)?.setAttribute('content', content);
}

export function applyAppearance(document: Document, appearance: Appearance): void {
  document.documentElement.dataset.appearance = appearance;
  setMeta(document, 'theme-color', THEME_COLORS[appearance]);
  setMeta(document, 'apple-mobile-web-app-status-bar-style', STATUS_BAR_STYLES[appearance]);
}
