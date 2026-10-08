import { describe, expect, it } from 'vitest';
import { isEditable } from './editable';

function input(type?: string): HTMLInputElement {
  const element = document.createElement('input');
  if (type) element.type = type;
  return element;
}

// jsdom does not implement isContentEditable, so set it the way a browser would.
function element(tag: string, isContentEditable: boolean): HTMLElement {
  const created = document.createElement(tag);
  Object.defineProperty(created, 'isContentEditable', { value: isContentEditable });
  return created;
}

describe('isEditable', () => {
  it('is true for a textarea', () => {
    expect(isEditable(document.createElement('textarea'))).toBe(true);
  });

  it.each(['text', 'search', 'email', 'url', 'tel', 'password', 'number'])(
    'is true for a %s input',
    (type) => {
      expect(isEditable(input(type))).toBe(true);
    },
  );

  it('is true for an input without a type, which browsers treat as text', () => {
    expect(isEditable(input())).toBe(true);
  });

  it.each(['checkbox', 'radio', 'button', 'submit', 'range', 'color', 'file', 'date', 'hidden'])(
    'is false for a %s input',
    (type) => {
      expect(isEditable(input(type))).toBe(false);
    },
  );

  it('is false for read-only fields', () => {
    const textarea = document.createElement('textarea');
    textarea.readOnly = true;
    const text = input('text');
    text.readOnly = true;
    expect(isEditable(textarea)).toBe(false);
    expect(isEditable(text)).toBe(false);
  });

  it('follows contentEditable for other elements', () => {
    expect(isEditable(element('div', true))).toBe(true);
    expect(isEditable(element('div', false))).toBe(false);
    expect(isEditable(element('button', false))).toBe(false);
  });

  it('is false without an element', () => {
    expect(isEditable(null)).toBe(false);
  });
});
