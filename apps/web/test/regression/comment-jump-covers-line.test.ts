import { expect, it } from 'vitest';
import { edges, phoneRule, pixels } from './phoneCss';

// PT-84, from PT-73's review: the '↓ Comment' pill floated 12px above the phone's bottom bar, so
// as the reader scrolled, each line passed between the bar and the pill and the pill sat on its
// end. It is now a tab of the bar: it stands on the bar's top edge with the bar's border around
// it and nothing under it, so text goes under it as under the bar, never between the two.

const JUMP = 'features/ticket/jump/CommentJump.module.css';

it('stands on the bar as a tab of it instead of floating over the text above', () => {
  const jump = phoneRule(JUMP, '.jump');
  expect(jump.get('bottom')).toBe('100%');
  expect(jump.get('border-bottom')).toBe('0');
  expect(jump.get('box-shadow')).toBeUndefined();
  const [topLeft, topRight, bottomRight, bottomLeft] = edges(jump.get('border-radius'));
  expect(Math.min(topLeft, topRight)).toBeGreaterThan(0);
  expect([bottomRight, bottomLeft]).toEqual([0, 0]);
});

it('stays small and still answers taps across 44px without reaching the bar’s buttons', () => {
  const jump = phoneRule(JUMP, '.jump');
  const [above, , below] = edges(phoneRule(JUMP, '.jump::before').get('inset'));
  const height = pixels(jump.get('height'));
  expect(height).toBeLessThan(32);
  expect(height - above - below).toBeGreaterThanOrEqual(44);
  // The bar's 10px padding above its buttons.
  expect(-below).toBeLessThanOrEqual(10);
});
