import { describe, expect, it } from 'vitest';
import {
  asksForCapture,
  hasOpenOverlay,
  isCaptureShortcut,
  isTypingTarget,
  withoutCaptureParam,
  type ShortcutKey,
} from './captureTriggers';

const key = (overrides: Partial<ShortcutKey> = {}): ShortcutKey => ({
  key: 'c',
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  repeat: false,
  isComposing: false,
  defaultPrevented: false,
  ...overrides,
});

const element = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  setup?: (el: HTMLElementTagNameMap[K]) => void,
) => {
  const el = document.createElement(tag);
  setup?.(el);
  return el;
};

describe('capture shortcut', () => {
  it('is C, in either case, while nothing takes text', () => {
    expect(isCaptureShortcut(key(), document.body)).toBe(true);
    expect(isCaptureShortcut(key({ key: 'C' }), null)).toBe(true);
    expect(isCaptureShortcut(key(), element('button'))).toBe(true);
  });

  it('leaves C alone with a modifier, while held or composing, or once handled', () => {
    expect(isCaptureShortcut(key({ metaKey: true }), document.body)).toBe(false);
    expect(isCaptureShortcut(key({ ctrlKey: true }), document.body)).toBe(false);
    expect(isCaptureShortcut(key({ altKey: true }), document.body)).toBe(false);
    expect(isCaptureShortcut(key({ repeat: true }), document.body)).toBe(false);
    expect(isCaptureShortcut(key({ isComposing: true }), document.body)).toBe(false);
    expect(isCaptureShortcut(key({ defaultPrevented: true }), document.body)).toBe(false);
    expect(isCaptureShortcut(key({ key: 'x' }), document.body)).toBe(false);
  });

  it('types the letter into text fields instead', () => {
    expect(isCaptureShortcut(key(), element('input'))).toBe(false);
    expect(isCaptureShortcut(key(), element('textarea'))).toBe(false);
  });
});

describe('isTypingTarget', () => {
  it('counts text inputs, textareas, selects and editable content', () => {
    expect(isTypingTarget(element('input'))).toBe(true);
    expect(isTypingTarget(element('input', (el) => (el.type = 'date')))).toBe(true);
    expect(isTypingTarget(element('textarea'))).toBe(true);
    expect(isTypingTarget(element('select'))).toBe(true);
    const editable = element('div');
    Object.defineProperty(editable, 'isContentEditable', { value: true });
    expect(isTypingTarget(editable)).toBe(true);
  });

  it('does not count buttons, checkboxes or the page', () => {
    expect(isTypingTarget(element('input', (el) => (el.type = 'checkbox')))).toBe(false);
    expect(isTypingTarget(element('button'))).toBe(false);
    expect(isTypingTarget(document.body)).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});

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

describe('capture link', () => {
  it('asks for capture with ?capture, valued or not', () => {
    expect(asksForCapture('?capture')).toBe(true);
    expect(asksForCapture('?capture=1&x=2')).toBe(true);
    expect(asksForCapture('?x=2')).toBe(false);
    expect(asksForCapture('')).toBe(false);
  });

  it('cleans only the capture parameter from the address', () => {
    expect(withoutCaptureParam('?capture')).toBe('');
    expect(withoutCaptureParam('?capture&x=2')).toBe('?x=2');
  });
});
