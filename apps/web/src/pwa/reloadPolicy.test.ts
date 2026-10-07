import { afterEach, describe, expect, it, vi } from 'vitest';
import { isSafeToReload } from './reloadPolicy';

function add<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attributes: Record<string, string> = {},
  parent: HTMLElement = document.body,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  parent.append(element);
  return element;
}

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe('isSafeToReload', () => {
  it('is safe on a visible page with no focused field and no dialog', () => {
    expect(isSafeToReload(document)).toBe(true);
  });

  it('waits while a textarea has focus', () => {
    add('textarea').focus();
    expect(isSafeToReload(document)).toBe(false);
  });

  it.each(['text', 'search', 'email', 'url', 'number', 'date'])(
    'waits while a %s input has focus',
    (type) => {
      add('input', { type }).focus();
      expect(isSafeToReload(document)).toBe(false);
    },
  );

  it.each(['checkbox', 'radio', 'button', 'range'])(
    'does not wait for a focused %s input',
    (type) => {
      add('input', { type }).focus();
      expect(isSafeToReload(document)).toBe(true);
    },
  );

  it('does not wait for a focused button', () => {
    add('button').focus();
    expect(isSafeToReload(document)).toBe(true);
  });

  it('is safe again once the field loses focus', () => {
    const field = add('textarea');
    field.focus();
    field.blur();
    expect(isSafeToReload(document)).toBe(true);
  });

  it.each([
    ['a sheet', 'div', { role: 'dialog', 'aria-modal': 'true' }],
    ['an alert dialog', 'div', { role: 'alertdialog' }],
    ['a native dialog', 'dialog', { open: '' }],
  ] as const)('waits while %s is open, even with nothing focused', (_name, tag, attributes) => {
    add(tag, attributes);
    expect(isSafeToReload(document)).toBe(false);
  });

  it('is safe again once the dialog is gone', () => {
    add('div', { role: 'dialog' }).remove();
    expect(isSafeToReload(document)).toBe(true);
  });

  it('does not count a closed native dialog', () => {
    add('dialog');
    expect(isSafeToReload(document)).toBe(true);
  });

  it('is safe in the background, even while typing in a sheet', () => {
    const sheet = add('div', { role: 'dialog' });
    add('textarea', {}, sheet).focus();
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    expect(isSafeToReload(document)).toBe(true);
  });
});
