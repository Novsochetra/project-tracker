import { describe, expect, it } from 'vitest';
import { isUndoShortcut, type ShortcutKey } from './undoShortcut';

const press = (overrides: Partial<ShortcutKey> = {}): ShortcutKey => ({
  key: 'z',
  metaKey: true,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  repeat: false,
  isComposing: false,
  defaultPrevented: false,
  ...overrides,
});

const element = (html: string): Element => {
  const host = document.createElement('div');
  host.innerHTML = html;
  const created = host.firstElementChild!;
  // jsdom does not implement isContentEditable, so set it the way a browser would.
  const editable = created.getAttribute('contenteditable') === 'true';
  Object.defineProperty(created, 'isContentEditable', { value: editable });
  return created;
};

describe('isUndoShortcut', () => {
  it('is ⌘Z, or Ctrl+Z on other systems', () => {
    expect(isUndoShortcut(press(), null)).toBe(true);
    expect(isUndoShortcut(press({ metaKey: false, ctrlKey: true }), null)).toBe(true);
    expect(isUndoShortcut(press({ key: 'Z', metaKey: false, ctrlKey: true }), null)).toBe(true);
  });

  it('is not Z alone, redo (⇧⌘Z), ⌥⌘Z, another key, a held key or a key already handled', () => {
    expect(isUndoShortcut(press({ metaKey: false }), null)).toBe(false);
    expect(isUndoShortcut(press({ shiftKey: true, key: 'Z' }), null)).toBe(false);
    expect(isUndoShortcut(press({ altKey: true }), null)).toBe(false);
    expect(isUndoShortcut(press({ key: 'y' }), null)).toBe(false);
    expect(isUndoShortcut(press({ repeat: true }), null)).toBe(false);
    expect(isUndoShortcut(press({ isComposing: true }), null)).toBe(false);
    expect(isUndoShortcut(press({ defaultPrevented: true }), null)).toBe(false);
  });

  it('leaves it to a text field or editable text that has focus, which undo their own typing', () => {
    expect(isUndoShortcut(press(), element('<input type="text">'))).toBe(false);
    expect(isUndoShortcut(press(), element('<textarea></textarea>'))).toBe(false);
    expect(isUndoShortcut(press(), element('<div contenteditable="true"></div>'))).toBe(false);
  });

  it('works from a button, a checkbox or the page', () => {
    expect(isUndoShortcut(press(), element('<button type="button">Status</button>'))).toBe(true);
    expect(isUndoShortcut(press(), element('<input type="checkbox">'))).toBe(true);
    expect(isUndoShortcut(press(), document.body)).toBe(true);
  });
});
