import { describe, expect, it } from 'vitest';
import { phoneRule } from './phoneCss';

// PT-112: a phone turned sideways keeps the phone layout (PT-84) on a short screen, about 296px
// under Safari's bars on an iPhone 17 Pro. The project ••• action sheet was taller than that: it
// grew past the top of the screen, which cut its caption and half of Edit project, and its rows
// couldn't scroll. The card of rows is what gives way: it shrinks and scrolls, while Cancel keeps
// its size and the sheet stops a margin below the top.

const ACTION_SHEET = 'overlays/ActionSheet.module.css';
const rule = (selector: string) => phoneRule(ACTION_SHEET, selector);

// A shorthand's values, keeping each calc() whole.
function values(shorthand: string): string[] {
  const parts = [''];
  let depth = 0;
  for (const char of shorthand.trim()) {
    depth += char === '(' ? 1 : char === ')' ? -1 : 0;
    if (depth === 0 && /\s/.test(char)) {
      if (parts.at(-1) !== '') parts.push('');
    } else parts[parts.length - 1] += char;
  }
  return parts;
}

// The px a length comes to with no safe area; the rule only adds lengths.
const withoutInsets = (value: string): number =>
  (value.replace(/env\([^)]*\)/g, '0px').match(/\d+(?:\.\d+)?px/g) ?? []).reduce(
    (sum, length) => sum + Number.parseFloat(length),
    0,
  );

describe('regression: a tall action sheet scrolls its rows instead of growing off the screen', () => {
  it('lets the sheet shrink to the screen, less a margin and the safe area at the top', () => {
    expect(rule('.sheet').get('min-height')).toBe('0');
    const [top = ''] = values(rule('.overlay').get('padding') ?? '');
    expect(top).toContain('safe-area-inset-top');
    expect(withoutInsets(top)).toBeGreaterThanOrEqual(8);
  });

  it('scrolls the card of rows inside the sheet, and keeps Cancel whole', () => {
    const card = rule('.card');
    expect(card.get('min-height')).toBe('0');
    expect(card.get('overflow-y')).toBe('auto');
    expect(card.get('overscroll-behavior')).toBe('contain');
    expect(rule('.cancel').get('flex')).toBe('none');
  });
});
