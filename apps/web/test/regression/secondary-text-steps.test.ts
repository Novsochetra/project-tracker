import { describe, expect, it } from 'vitest';
import { color, lightness } from './contrast';

// Dark to light. Each sits next to the one after it: a due date beside the key in phone rows, a
// Muted label beside a Subtle count ("Active 5"), Muted text beside a Placeholder time or "None".
const LADDER = ['--muted-2', '--muted', '--subtle', '--placeholder'];

// CIELAB L*: the smallest step the approved design draws between these grays (Subtle #8E8E99 →
// Placeholder #9A9AA3). 4.5:1 text contrast caps how light they can be, which squeezed them together.
const MIN_STEP = 4.5;

const steps = LADDER.slice(1).map((lighter, index) => ({ darker: LADDER[index]!, lighter }));

describe('regression: secondary text grays stay visibly apart', () => {
  it.each(steps)('$darker is a visible step darker than $lighter', ({ darker, lighter }) => {
    const step = lightness(color(lighter)) - lightness(color(darker));
    expect(step, `${darker} → ${lighter} is ${step.toFixed(2)} L*`).toBeGreaterThanOrEqual(
      MIN_STEP,
    );
  });
});
