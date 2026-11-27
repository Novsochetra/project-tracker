import { describe, expect, it } from 'vitest';
import { edges, phoneRule, pixels } from './phoneCss';

// The owner found phone controls far bigger than on the web (PT-264): each was drawn at its 44px
// tap size. iOS draws them smaller (segmented 32pt, buttons 30pt and 36pt) and keeps a 44pt tap
// area, so these do too.

const TAP = 44;
const topInset = (module: string, selector: string) =>
  edges(phoneRule(module, selector).get('inset'))[0];

describe('regression: phone controls are drawn at iOS sizes with 44px tap areas', () => {
  it.each([
    ['components/Segmented/Segmented.module.css', '.segment', '.track::before'],
    ['features/project/tabs/FilterTabs.module.css', '.tab', '.frame::before'],
  ])('%s: 44px targets under a 32px track', (module, target, track) => {
    expect(pixels(phoneRule(module, target).get('min-height'))).toBe(TAP);
    expect(TAP - 2 * topInset(module, track)).toBe(32);
  });

  it('draws the search field 32px tall and lets its label take taps 44px tall', () => {
    const module = 'components/SearchField/SearchField.module.css';
    const drawn = pixels(phoneRule(module, '.field').get('min-height'));
    expect(drawn).toBe(32);
    expect(drawn - 2 * topInset(module, '.field::before')).toBe(TAP);
  });

  it.each([
    ['.sm', 30],
    ['.md', 36],
  ])('draws %s buttons %ipx tall with a 44px tap area', (size, drawn) => {
    const module = 'components/Button/Button.module.css';
    expect(pixels(phoneRule(module, size).get('min-height'))).toBe(drawn);
    expect(drawn - 2 * topInset(module, `${size}::before`)).toBe(TAP);
  });
});
