import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setAppearanceChoice } from './appearanceSetting';
import { DARK_SCHEME_QUERY } from './resolveAppearance';
import { startAppearance } from './startAppearance';
import { fakeMedia } from './test/fakeMedia';

let media: ReturnType<typeof fakeMedia>;
let stop = () => undefined as void;
const appearance = () => document.documentElement.dataset.appearance;

beforeEach(() => {
  media = fakeMedia(window);
  document.head.innerHTML = '<meta name="theme-color" content="#ffffff" />';
});

afterEach(() => {
  stop();
  media.restore();
  setAppearanceChoice('system');
  localStorage.clear();
  document.head.innerHTML = '';
});

describe('startAppearance', () => {
  it('follows the system, and its switch while the app is open', () => {
    media.set(DARK_SCHEME_QUERY, true);
    stop = startAppearance(window);
    expect(appearance()).toBe('dark');
    media.set(DARK_SCHEME_QUERY, false);
    expect(appearance()).toBe('light');
    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute(
      'content',
      '#ffffff',
    );
  });

  it('takes the person’s choice over the system at once', () => {
    stop = startAppearance(window);
    expect(appearance()).toBe('light');
    setAppearanceChoice('dark');
    expect(appearance()).toBe('dark');
    media.set(DARK_SCHEME_QUERY, false);
    expect(appearance()).toBe('dark');
  });
});
