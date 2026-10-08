import { describe, expect, it } from 'vitest';
import { edges, phoneRule, pixels } from './phoneCss';

const MODULE = 'features/attachments/ThumbnailGrid.module.css';
// The comment box and the capture sheet show 56px thumbnails, a ticket's images 72px.
const THUMB_SIZES = [56, 72];

interface Span {
  from: number;
  to: number;
}

// The x's touch target, measured from its thumbnail's right edge leftwards and from its top edge
// downwards; negative values lie outside the thumbnail.
function removeTarget(): { across: Span; down: Span } {
  const x = phoneRule(MODULE, '.remove');
  const [top, right, bottom, left] = edges(phoneRule(MODULE, '.remove::before').get('inset'));
  const fromRight = pixels(x.get('right'));
  const fromTop = pixels(x.get('top'));
  return {
    across: { from: fromRight + right, to: fromRight + pixels(x.get('width')) - left },
    down: { from: fromTop + top, to: fromTop + pixels(x.get('height')) - bottom },
  };
}

const covers = (span: Span, point: number) => span.from < point && point < span.to;

// The phone x's 44x44 target reached 30px into its thumbnail from the top and from the right,
// past the middle of a 56px thumbnail, so a tap in the middle of a photo in the comment box or
// the capture sheet removed it at once.
describe('regression: a tap in the middle of a thumbnail never reaches its remove button', () => {
  it.each(THUMB_SIZES)('leaves the middle of a %ipx thumbnail alone', (size) => {
    const { across, down } = removeTarget();
    expect(covers(across, size / 2) && covers(down, size / 2)).toBe(false);
  });

  it('keeps a 44x44 target that stays in the space around its thumbnail', () => {
    const { across, down } = removeTarget();
    const grid = phoneRule(MODULE, '.grid.removable');
    const columnGap = pixels(grid.get('column-gap') ?? grid.get('gap'));
    const rowGap = pixels(grid.get('row-gap') ?? grid.get('gap'));
    expect(across.to - across.from).toBeGreaterThanOrEqual(44);
    expect(down.to - down.from).toBeGreaterThanOrEqual(44);
    expect(-across.from).toBeLessThan(columnGap);
    expect(-down.from).toBeLessThan(rowGap);
    expect(-down.from).toBeLessThan(pixels(grid.get('padding-top')));
  });
});
