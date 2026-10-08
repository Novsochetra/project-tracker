import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { actionSheetContent, textOf } from './actionSheetContent';

const remove = { label: 'Delete', tone: 'danger', bold: true };

describe('textOf', () => {
  it('reads strings, numbers, lists and the children of elements', () => {
    const caption = createElement(
      'span',
      { role: 'alert' },
      'Delete “App” and its ',
      7,
      ' tickets?',
    );
    expect(textOf(caption)).toBe('Delete “App” and its 7 tickets?');
    expect(textOf(['a', ['b', null], false, undefined])).toBe('ab');
  });
});

describe('actionSheetContent', () => {
  it('changes when only the caption does', () => {
    expect(actionSheetContent('Delete this comment?', [remove])).not.toBe(
      actionSheetContent('Delete this report?', [remove]),
    );
  });

  it('changes when a row’s label, tone or weight does', () => {
    const before = actionSheetContent('Options', [remove]);
    expect(actionSheetContent('Options', [{ ...remove, label: 'Remove' }])).not.toBe(before);
    expect(actionSheetContent('Options', [{ label: 'Delete', bold: true }])).not.toBe(before);
    expect(actionSheetContent('Options', [{ ...remove, bold: false }])).not.toBe(before);
  });

  it('stays the same for the same content in new objects', () => {
    expect(actionSheetContent(createElement('span', null, 'Mobile app'), [{ ...remove }])).toBe(
      actionSheetContent('Mobile app', [remove]),
    );
  });
});
