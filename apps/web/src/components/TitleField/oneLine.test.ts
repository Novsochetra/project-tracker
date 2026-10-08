import { describe, expect, it } from 'vitest';
import { keepOneLine, oneLine, oneLineInsert } from './oneLine';

function textarea(value: string, caret: number): HTMLTextAreaElement {
  const field = document.createElement('textarea');
  field.value = value;
  field.setSelectionRange(caret, caret);
  return field;
}

describe('oneLine', () => {
  it('turns each line break, with the spaces around it, into one space', () => {
    expect(oneLine('First\nsecond')).toBe('First second');
    expect(oneLine('First \r\n\r\n  second\rthird\n')).toBe('First second third ');
  });

  it('leaves text without line breaks alone, spaces included', () => {
    expect(oneLine('  Two  spaces\tand a tab ')).toBe('  Two  spaces\tand a tab ');
  });
});

describe('oneLineInsert', () => {
  it('turns breaks between words into spaces', () => {
    expect(oneLineInsert(' the\r\n\r\n login', 'Fix', ' crash')).toBe(' the login');
    expect(oneLineInsert('\n', 'Fix', '')).toBe(' ');
    expect(oneLineInsert('login\n', 'Fix the ', '')).toBe('login ');
  });

  it('adds no space at the start of the field or beside a space already there', () => {
    expect(oneLineInsert('\nLeading break', '', '')).toBe('Leading break');
    expect(oneLineInsert('\n', 'Fix ', 'crash')).toBe('');
    expect(oneLineInsert(' the login \n', 'Fix', ' crash')).toBe(' the login');
    expect(oneLineInsert('\n\n', 'Fix', ' crash')).toBe('');
  });

  it('leaves spaces that are not beside a break alone', () => {
    expect(oneLineInsert(' the  login ', 'Fix ', ' crash')).toBe(' the  login ');
  });
});

describe('keepOneLine', () => {
  it('rewrites a field with line breaks and keeps the caret after the same text', () => {
    const field = textarea('Fix the\nlogin\n crash', 14);
    expect(keepOneLine(field)).toBe('Fix the login crash');
    expect(field.value).toBe('Fix the login crash');
    expect(field.selectionStart).toBe(14);
    expect(field.selectionEnd).toBe(14);
  });

  it('leaves a field without line breaks untouched', () => {
    const field = textarea('Fix login', 3);
    expect(keepOneLine(field)).toBe('Fix login');
    expect(field.selectionStart).toBe(3);
  });
});
