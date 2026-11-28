import { describe, expect, it } from 'vitest';
import { APPEARANCES, color, lightness } from './contrast';

// Strongest to faintest. Each sits next to the one after it: a due date beside the key in phone
// rows, a Muted label beside a Subtle count ("Active 5"), Muted text beside a Placeholder time or
// "None". Fainter is lighter in the light appearance and darker in the dark one.
const LADDER = ['--muted-2', '--muted', '--subtle', '--placeholder'];

// CIELAB L*: the smallest step the approved design draws between these grays (Subtle #8E8E99 →
// Placeholder #9A9AA3). 4.5:1 text contrast caps how light they can be, which squeezed them together.
const MIN_STEP = 4.5;

const steps = APPEARANCES.flatMap((appearance) =>
  LADDER.slice(1).map((fainter, index) => ({ appearance, stronger: LADDER[index]!, fainter })),
);

describe('regression: secondary text grays stay visibly apart', () => {
  it.each(steps)(
    '$appearance: $stronger is a visible step stronger than $fainter',
    ({ appearance, stronger, fainter }) => {
      const toward = appearance === 'light' ? 1 : -1;
      const step =
        toward * (lightness(color(fainter, appearance)) - lightness(color(stronger, appearance)));
      expect(step, `${stronger} → ${fainter} is ${step.toFixed(2)} L*`).toBeGreaterThanOrEqual(
        MIN_STEP,
      );
    },
  );
});
