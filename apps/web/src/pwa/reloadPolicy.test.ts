import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearDraft, markDraft } from '../lib/drafts';
import { setPendingWrites } from '../lib/pendingWrites';
import { isSafeToReload } from './reloadPolicy';

const writer = {};

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

function hidePage() {
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
}

afterEach(() => {
  document.body.replaceChildren();
  clearDraft('comment:PT-1');
  setPendingWrites(writer, false);
  vi.restoreAllMocks();
});

describe('isSafeToReload', () => {
  it('is safe on a visible page with nothing focused, open, drafted or saving', () => {
    expect(isSafeToReload(document)).toBe(true);
  });

  it('waits while a text field has focus', () => {
    add('textarea').focus();
    expect(isSafeToReload(document)).toBe(false);
  });

  it('does not wait for a focused control that takes no typing', () => {
    add('input', { type: 'checkbox' }).focus();
    expect(isSafeToReload(document)).toBe(true);
  });

  it('does not wait for a focused read-only field', () => {
    add('input', { type: 'text', readonly: '' }).focus();
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

  it('waits while an unsent draft is marked, even with nothing focused', () => {
    markDraft('comment:PT-1');
    expect(isSafeToReload(document)).toBe(false);
    clearDraft('comment:PT-1');
    expect(isSafeToReload(document)).toBe(true);
  });

  it('waits while a write is in flight', () => {
    setPendingWrites(writer, true);
    expect(isSafeToReload(document)).toBe(false);
    setPendingWrites(writer, false);
    expect(isSafeToReload(document)).toBe(true);
  });

  it('waits in the background while typing in a sheet', () => {
    const sheet = add('div', { role: 'dialog' });
    add('textarea', {}, sheet).focus();
    hidePage();
    expect(isSafeToReload(document)).toBe(false);
  });

  it('waits in the background while a draft or a write is pending', () => {
    hidePage();
    markDraft('comment:PT-1');
    expect(isSafeToReload(document)).toBe(false);
    clearDraft('comment:PT-1');
    setPendingWrites(writer, true);
    expect(isSafeToReload(document)).toBe(false);
  });

  it('is safe in the background once nothing is in progress', () => {
    hidePage();
    expect(isSafeToReload(document)).toBe(true);
  });
});
