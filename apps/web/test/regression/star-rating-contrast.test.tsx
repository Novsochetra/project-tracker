import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StarRating } from '../../src/components/StarRating';
import { color, contrast, rgb, type Rgb } from './contrast';
import { phoneRule } from './phoneCss';

const CSS = 'components/StarRating/StarRating.module.css';

// WCAG 1.4.11 for the stars, 1.4.3 for the score next to them.
const AA_GRAPHIC = 3;
const AA_TEXT = 4.5;

// Review cards and Latest review sit on Surface; a Ready for you row is Fill while hovered or pressed.
const BACKGROUNDS = ['--surface', '--fill'];

const cssColor = (selector: string): Rgb => rgb(phoneRule(CSS, selector).get('color') ?? '');

// A hollow empty star shows the background inside it.
function insideEmptyStar(background: string): Rgb {
  return phoneRule(CSS, '.off').get('fill') === 'none' ? color(background) : cssColor('.off');
}

function expectContrast(first: Rgb, second: Rgb, minimum: number): void {
  const ratio = contrast(first, second);
  expect(ratio, `${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(minimum);
}

describe('regression: star ratings read at a glance', () => {
  it.each(BACKGROUNDS)('filled stars reach 3:1 on %s', (background) => {
    expectContrast(cssColor('.on'), color(background), AA_GRAPHIC);
  });

  it.each(BACKGROUNDS)('filled stars reach 3:1 against empty stars on %s', (background) => {
    expectContrast(cssColor('.on'), insideEmptyStar(background), AA_GRAPHIC);
  });

  it.each(BACKGROUNDS)('the score next to them reaches 4.5:1 on %s', (background) => {
    expectContrast(cssColor('.score'), color(background), AA_TEXT);
  });

  // The stylesheet draws them in tokens, so the dark set's values stand in for them there; review
  // cards and rows are raised on the black page, and a sheet's cards a step more.
  it.each(['--surface', '--fill', '--grouped-surface'])(
    'dark: filled stars reach 3:1 and the score 4.5:1 on %s',
    (background) => {
      expect(cssColor('.on')).toEqual(color('--star'));
      expect(cssColor('.score')).toEqual(color('--muted'));
      expectContrast(color('--star', 'dark'), color(background, 'dark'), AA_GRAPHIC);
      expectContrast(color('--muted', 'dark'), color(background, 'dark'), AA_TEXT);
    },
  );

  it('shows the score as a number, which screen readers get from the label', () => {
    render(<StarRating value={4} />);
    expect(screen.getByRole('img', { name: 'Rated 4 out of 5' })).toHaveTextContent('4/5');
  });
});
