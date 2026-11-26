import { afterEach, describe, expect, it } from 'vitest';
import { isTrackpadSwipeTarget } from './swipeTarget';

function mount(html: string): HTMLElement {
  document.body.innerHTML = html;

  return document.getElementById('target')!;
}

function makeWide(element: HTMLElement) {
  Object.defineProperty(element, 'scrollWidth', { value: 900 });
  Object.defineProperty(element, 'clientWidth', { value: 300 });
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('isTrackpadSwipeTarget', () => {
  it('accepts plain page content', () => {
    expect(isTrackpadSwipeTarget(mount('<main><p id="target">Hi</p></main>'))).toBe(true);
  });

  it('refuses a field whose text runs past its width, and only that one', () => {
    expect(isTrackpadSwipeTarget(mount('<textarea id="target"></textarea>'))).toBe(true);
    const field = mount('<input id="target" />');
    makeWide(field);
    expect(isTrackpadSwipeTarget(field)).toBe(false);
  });

  it('refuses places marked as no-swipe', () => {
    expect(isTrackpadSwipeTarget(mount('<div data-no-swipe><p id="target">x</p></div>'))).toBe(
      false,
    );
  });

  it('refuses content inside a sideways scroller', () => {
    const target = mount('<div id="row" style="overflow-x: auto"><p id="target">x</p></div>');
    makeWide(document.getElementById('row')!);
    expect(isTrackpadSwipeTarget(target)).toBe(false);
  });

  it('accepts content in a wide box that clips instead of scrolling', () => {
    const target = mount('<div id="row" style="overflow-x: hidden"><p id="target">x</p></div>');
    makeWide(document.getElementById('row')!);
    expect(isTrackpadSwipeTarget(target)).toBe(true);
  });

  it('refuses while a dropdown or menu is open', () => {
    expect(isTrackpadSwipeTarget(mount('<div role="listbox"></div><p id="target">x</p>'))).toBe(
      false,
    );
    const menu = '<button aria-label="Close menu"></button><p id="target">x</p>';
    expect(isTrackpadSwipeTarget(mount(menu))).toBe(false);
  });

  it('refuses while a modal is open, but not for a closed inert one', () => {
    const open = '<div aria-modal="true"></div><p id="target">x</p>';
    expect(isTrackpadSwipeTarget(mount(open))).toBe(false);
    const closed = '<div inert><div aria-modal="true"></div></div><p id="target">x</p>';
    expect(isTrackpadSwipeTarget(mount(closed))).toBe(true);
  });

  it('refuses targets that are not elements', () => {
    expect(isTrackpadSwipeTarget(null)).toBe(false);
  });
});
