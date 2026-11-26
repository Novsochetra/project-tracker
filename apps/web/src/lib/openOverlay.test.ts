import { describe, expect, it } from 'vitest';
import { hasOpenOverlay } from './openOverlay';

describe('hasOpenOverlay', () => {
  const page = (html: string) => {
    const root = document.createElement('div');
    root.innerHTML = html;

    return root;
  };

  it('sees sheets, dropdowns, menus and the layers that close popover menus', () => {
    expect(hasOpenOverlay(page('<div role="dialog" aria-modal="true"></div>'))).toBe(true);
    expect(hasOpenOverlay(page('<div role="listbox"></div>'))).toBe(true);
    expect(hasOpenOverlay(page('<div role="menu"></div>'))).toBe(true);
    expect(hasOpenOverlay(page('<button aria-label="Close menu"></button>'))).toBe(true);
  });

  it('ignores a closing panel, which stays inert for a moment', () => {
    const closing =
      '<div inert><div role="listbox"></div></div><div role="dialog" aria-modal="true" inert></div>';
    expect(hasOpenOverlay(page(closing))).toBe(false);
  });

  it('ignores groups and expanded buttons, which also mark headers and segments', () => {
    const quiet = '<div role="group"></div><button aria-expanded="true">Done 3</button>';
    expect(hasOpenOverlay(page(quiet))).toBe(false);
  });
});
