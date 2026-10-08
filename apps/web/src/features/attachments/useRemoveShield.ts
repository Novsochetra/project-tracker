import { useState, type MouseEvent } from 'react';
import { useClickShield } from '../../lib/clickShield';

export interface RemoveShield {
  guard: ((event: MouseEvent) => void) | undefined;
  removed: () => void;
}

// The next file takes a removed one's place at once, with its x under the finger or the mouse, so
// the second press of a double tap or double-click removed it too: on phones, touch tablets as wide
// as a desktop, and with a mouse. Once an x is pressed the grid drops a pointer's presses for
// CLICK_SHIELD_MS; keys go through (useClickShield). Not before the first one: useClickShield also
// holds presses back right after it mounts, and the grid appears as files are picked, with nothing
// under the finger.
export function useRemoveShield(): RemoveShield {
  const [removals, setRemovals] = useState(0);
  const shield = useClickShield(removals);
  return {
    guard: removals > 0 ? shield : undefined,
    removed: () => setRemovals((count) => count + 1),
  };
}
