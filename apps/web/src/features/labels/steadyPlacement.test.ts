import { describe, expect, it } from 'vitest';
import { steadyPlacement } from './steadyPlacement';

const above = { top: 347, left: 623, height: 139, room: 400, up: true, originX: 258 };
const below = { ...above, top: 361, up: false };

describe('steadyPlacement', () => {
  it('takes the first placement as it is and keeps where its field sits', () => {
    const first = steadyPlacement(above, 490, null);
    expect(first.placement).toBe(above);
    expect(first.opened).toEqual({ anchorTop: 490, up: true, fieldEdge: 486 });
  });

  it('above its row, keeps the bottom edge, by the field, as the menu shrinks and grows', () => {
    const { opened } = steadyPlacement(above, 490, null);
    const shorter = steadyPlacement({ ...above, top: 402, height: 84 }, 490, opened);
    expect(shorter.placement.top + shorter.placement.height).toBe(486);
    const taller = steadyPlacement({ ...above, top: 100, height: 380 }, 490, opened);
    expect(taller.placement.top).toBe(486 - 380);
  });

  it('below its row, keeps the top edge, by the field', () => {
    const { opened } = steadyPlacement(below, 313, null);
    const grown = steadyPlacement({ ...below, top: 355, height: 300 }, 313, opened);
    expect(grown.placement.top).toBe(361);
  });

  it('starts afresh once its row moved or it changed sides', () => {
    const { opened } = steadyPlacement(above, 490, null);
    expect(steadyPlacement({ ...above, top: 200 }, 340, opened).placement.top).toBe(200);
    expect(steadyPlacement(below, 490, opened).placement.top).toBe(361);
  });
});
