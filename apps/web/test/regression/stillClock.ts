import { act } from '@testing-library/react';
import { vi } from 'vitest';

// Taken when the test file loads, before any test fakes them.
const { setInterval: realInterval, clearInterval: realClearInterval } = globalThis;

// An advance leaves the clock mid-tick between its timers, and a tick from the interval would cut in.
let advancing = false;

// On a busy machine a test's own steps can take longer than the times it tests (PT-167): the second
// tap of a "200 ms" double tap came after the 500 ms shield had ended. From here performance.now
// and the timers, and the rest of the clock when the test already fakes it, move only when the test
// advances them; a fake clock that follows the real one would let the busy machine's time back in.
// Timers due now still run: the next task that React Testing Library, user-event and TanStack Query
// wait for.
export function stillClock(): () => void {
  const installed = !vi.isFakeTimers();
  if (installed) {
    const now = Math.ceil(performance.now());
    vi.useFakeTimers({ toFake: ['performance', 'setTimeout', 'clearTimeout'] });
    // Marks the page took before keep their meaning. Whole milliseconds, since a fraction made
    // "500 ms later" read 499.99… and the shield still held the tap.
    vi.advanceTimersByTime(now);
  }
  vi.setTimerTickMode('manual');
  const due = realInterval(() => {
    if (!advancing) vi.advanceTimersByTime(0);
  }, 1);
  return () => {
    realClearInterval(due);
    if (installed) vi.useRealTimers();
  };
}

export async function advance(ms: number): Promise<void> {
  advancing = true;
  try {
    await act(() => vi.advanceTimersByTimeAsync(ms));
  } finally {
    advancing = false;
  }
}
