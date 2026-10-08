import { describe, expect, it } from 'vitest';
import { autoScrollStep } from '../../src/features/project/dnd/autoScroll';

// SPEC §7.4: the list scrolls by ceil(distance into the zone / 5); a pointer dragged past the
// window edge keeps speeding up. The board's capped speed must not leak into the list.
describe('regression: list auto-scroll keeps speeding up past the window edge', () => {
  it('scrolls down faster the further below the window the pointer is', () => {
    expect(autoScrollStep(900, 800, false)).toBe(28);
  });

  it('scrolls up faster the further above the window the pointer is', () => {
    expect(autoScrollStep(-80, 800, false)).toBe(-31);
    expect(autoScrollStep(-200, 800, false)).toBe(-55);
  });
});
