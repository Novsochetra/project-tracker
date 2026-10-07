export type Clock = (count?: number) => number;

// Strictly increasing stamps keep activity order stable when operations share a millisecond,
// and a reserved block keeps one operation's rows at now, now+1, now+2… even across a tick.
export function createClock(source: () => number = Date.now): Clock {
  let last = 0;
  return (count = 1) => {
    const first = Math.max(source(), last + 1);
    last = first + Math.max(count, 1) - 1;
    return first;
  };
}
