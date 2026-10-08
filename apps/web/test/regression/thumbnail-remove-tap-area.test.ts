import { describe, expect, it } from 'vitest';
import { edges, phoneRule, pixels } from './phoneCss';

const MODULE = 'features/attachments/ThumbnailGrid.module.css';
// Ticket thumbnails are 72px and open on tap; the x must leave their middle alone.
const OPENABLE_THUMB = 72;

function removeTarget() {
  const x = phoneRule(MODULE, '.remove');
  const [top, right, bottom, left] = edges(phoneRule(MODULE, '.remove::before').get('inset'));
  const size = { width: pixels(x.get('width')), height: pixels(x.get('height')) };
  const overhang = { top: -pixels(x.get('top')), right: -pixels(x.get('right')) };
  return {
    width: size.width - left - right,
    height: size.height - top - bottom,
    pastRight: overhang.right - right,
    aboveTop: overhang.top - top,
    intoFromRight: size.width - overhang.right - left,
    intoFromTop: size.height - overhang.top - bottom,
  };
}

// The phone x got a 44x44 target that reached 18px past its tile, while removable grids leave
// 16px around their tiles: it covered a strip of the next thumbnail and of the description.
describe('regression: the phone x on thumbnails has a 44x44 target that stays in its gaps', () => {
  it('is at least 44x44', () => {
    const target = removeTarget();
    expect(target.width).toBeGreaterThanOrEqual(44);
    expect(target.height).toBeGreaterThanOrEqual(44);
  });

  it('stops short of the next thumbnail and of whatever is above the grid', () => {
    const grid = phoneRule(MODULE, '.grid.removable');
    const target = removeTarget();
    expect(target.pastRight).toBeLessThan(pixels(grid.get('gap')));
    expect(target.aboveTop).toBeLessThan(pixels(grid.get('padding-top')));
  });

  it('leaves the middle of a thumbnail to open it', () => {
    const target = removeTarget();
    expect(target.intoFromRight).toBeLessThan(OPENABLE_THUMB / 2);
    expect(target.intoFromTop).toBeLessThan(OPENABLE_THUMB / 2);
  });
});
