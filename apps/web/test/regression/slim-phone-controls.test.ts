import { describe, expect, it } from 'vitest';
import { edges, phoneRule, pixels } from './phoneCss';

// The owner found phone controls far bigger than on the web, then tabs, search, switch and buttons
// each a different height (PT-264). Now every phone control is drawn at one height, as iOS draws
// its controls smaller than their 44pt tap areas, and each keeps a 44px tap area.

const TAP = 44;
const DRAWN = 40;
const topInset = (module: string, selector: string) =>
  edges(phoneRule(module, selector).get('inset'))[0];

describe('regression: phone controls share one drawn height and keep 44px tap areas', () => {
  it.each([
    ['components/Segmented/Segmented.module.css', '.segment', '.track::before'],
    ['features/project/tabs/FilterTabs.module.css', '.tab', '.frame::before'],
  ])('%s: 44px targets under a track drawn at the shared height', (module, target, track) => {
    expect(pixels(phoneRule(module, target).get('min-height'))).toBe(TAP);
    expect(TAP - 2 * topInset(module, track)).toBe(DRAWN);
  });

  it('draws the search field at the shared height and lets its label take taps 44px tall', () => {
    const module = 'components/SearchField/SearchField.module.css';
    const drawn = pixels(phoneRule(module, '.field').get('min-height'));
    expect(drawn).toBe(DRAWN);
    expect(drawn - 2 * topInset(module, '.field::before')).toBe(TAP);
  });

  it('draws every button size at the shared height, with a 44px tap area', () => {
    const module = 'components/Button/Button.module.css';
    const drawn = pixels(phoneRule(module, '.sm,\n  .md,\n  .lg').get('min-height'));
    const reach = topInset(module, '.sm::before,\n  .md::before,\n  .lg::before,\n  .bar::before');
    expect(drawn).toBe(DRAWN);
    expect(drawn - 2 * reach).toBe(TAP);
  });

  it('draws the bottom bar button at the shared height', () => {
    const bar = phoneRule('components/Button/Button.module.css', '.bar');
    expect(pixels(bar.get('min-height'))).toBe(DRAWN);
  });
});
