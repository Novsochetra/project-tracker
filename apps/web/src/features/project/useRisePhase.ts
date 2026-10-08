import { useState } from 'react';

export type RisePhase = 'a' | 'b';

// A new tab flips the keyframe name, which replays the rise on the groups already shown. Remounting
// them instead would drop the focus a closing sheet returns to a group's "+".
export function useRisePhase(filter: string): RisePhase {
  const [seen, setSeen] = useState<{ filter: string; phase: RisePhase }>({ filter, phase: 'a' });
  if (seen.filter === filter) return seen.phase;
  const next = { filter, phase: seen.phase === 'a' ? 'b' : 'a' } as const;
  setSeen(next);
  return next.phase;
}
