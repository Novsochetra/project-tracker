import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { applyAppearance } from './themeMeta';

const meta = (name: string) =>
  document.querySelector(`meta[name="${name}"]`)?.getAttribute('content');

beforeEach(() => {
  document.head.innerHTML = `
    <meta name="theme-color" content="#ffffff" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />`;
});

afterEach(() => {
  document.head.innerHTML = '';
  delete document.documentElement.dataset.appearance;
});

describe('applyAppearance', () => {
  it('darkens the page, the browser’s bars and the iPhone’s status bar', () => {
    applyAppearance(document, 'dark');
    expect(document.documentElement).toHaveAttribute('data-appearance', 'dark');
    expect(meta('theme-color')).toBe('#000000');
    expect(meta('apple-mobile-web-app-status-bar-style')).toBe('black');
  });

  it('brings them back to light', () => {
    applyAppearance(document, 'dark');
    applyAppearance(document, 'light');
    expect(document.documentElement).toHaveAttribute('data-appearance', 'light');
    expect(meta('theme-color')).toBe('#ffffff');
    expect(meta('apple-mobile-web-app-status-bar-style')).toBe('default');
  });
});
