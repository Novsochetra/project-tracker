import { useState } from 'react';

// A closed sheet can stay mounted until its host shows another one, so per-opening state is
// keyed by this count: each opening starts fresh while the closing one keeps its content for the
// exit animation.
export function useOpenSession(open: boolean): number {
  const [session, setSession] = useState({ open, count: open ? 1 : 0 });
  if (session.open !== open) {
    setSession({ open, count: open ? session.count + 1 : session.count });
  }
  return session.count;
}
