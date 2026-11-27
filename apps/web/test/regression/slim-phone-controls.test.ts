import { describe, expect, it } from 'vitest';
import { edges, phoneRule, pixels } from './phoneCss';

// The owner found phone controls far bigger than on the web, then tabs, search, switch and buttons
// each a different height (PT-264). Every phone control is now drawn at one height, as iOS draws
// controls inside 44pt tap areas, and keeps a 44px tap area. A reach set as an inset was measured
// inside the 1px border and gave 42px (review), so the tap area is a 44px layer centred on it.

const TAP = 44;
const DRAWN = 40;

// A 44px ::before centred on its control, whatever the control's border.
function expectCentredTapArea(module: string, selector: string): void {
  const area = phoneRule(module, selector);
  expect(pixels(area.get('height'))).toBe(TAP);
  expect(area.get('top')).toBe('50%');
  expect(area.get('translate')).toBe('0 -50%');
}

describe('regression: phone controls share one drawn height and keep 44px tap areas', () => {
  it.each([
    ['components/Segmented/Segmented.module.css', '.segment', '.track::before'],
    ['features/project/tabs/FilterTabs.module.css', '.tab', '.frame::before'],
  ])('%s: 44px targets under a track drawn at the shared height', (module, target, track) => {
    expect(pixels(phoneRule(module, target).get('min-height'))).toBe(TAP);
    expect(TAP - 2 * edges(phoneRule(module, track).get('inset'))[0]).toBe(DRAWN);
  });

  it('draws the search field at the shared height with a 44px tap area', () => {
    const module = 'components/SearchField/SearchField.module.css';
    expect(pixels(phoneRule(module, '.field').get('min-height'))).toBe(DRAWN);
    expectCentredTapArea(module, '.field::before');
    // The text itself sits above that area, so taps in it reach the input.
    expect(phoneRule(module, '.input').get('position')).toBe('relative');
  });

  it('draws every button size and the bottom bar button at the shared height', () => {
    const module = 'components/Button/Button.module.css';
    expect(pixels(phoneRule(module, '.sm,\n  .md,\n  .lg').get('min-height'))).toBe(DRAWN);
    expect(pixels(phoneRule(module, '.bar').get('min-height'))).toBe(DRAWN);
    expectCentredTapArea(module, '.sm::before,\n  .md::before,\n  .lg::before,\n  .bar::before');
  });

  it('draws the sheet header button and the ticket chips at the shared height', () => {
    expect(pixels(phoneRule('overlays/SheetButtons.module.css', '.action').get('min-height'))).toBe(
      DRAWN,
    );
    expectCentredTapArea('overlays/SheetButtons.module.css', '.action::before');
    const chips = 'features/ticket/details/DetailChips.module.css';
    expect(pixels(phoneRule(chips, '.chip').get('height'))).toBe(DRAWN);
    expectCentredTapArea(chips, '.chip::before');
  });

  it('lets a switch in a 40px setting row keep its 44px tap area', () => {
    const card = (module: string, selector: string) => phoneRule(module, selector).get('overflow');
    expect(card('components/SwitchSection/SwitchSection.module.css', '.card')).toBe('visible');
    expect(card('features/projects/ProjectSheet.module.css', '.switchCard')).toBe('visible');
  });
});
