import { useState, type MouseEvent } from 'react';
import { useClickShield } from '../../lib/clickShield';
import { useIsPhone } from '../../lib/media';

export interface RemoveShield {
  guard: ((event: MouseEvent) => void) | undefined;
  removed: () => void;
}

// The next file takes a removed one's place at once, with its x under the finger, so on phones the
// second tap of a double tap removed it too. After a removal the grid drops a pointer's presses for
// CLICK_SHIELD_MS. Not before the first one: useClickShield also holds presses back right after it
// mounts, and the grid appears as files are picked, with nothing under the finger. A mouse's
// double-click on desktop is left as it was.
export function useRemoveShield(): RemoveShield {
  const isPhone = useIsPhone();
  const [removals, setRemovals] = useState(0);
  const shield = useClickShield(removals);
  return {
    guard: isPhone && removals > 0 ? shield : undefined,
    removed: () => setRemovals((count) => count + 1),
  };
}
