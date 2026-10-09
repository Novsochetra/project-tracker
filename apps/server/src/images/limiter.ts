export type Limiter = <T>(task: () => Promise<T>) => Promise<T>;

// A task that finishes hands its place straight to the next one waiting, so a task started in
// between can't take it too.
export function createLimiter(max: number): Limiter {
  let running = 0;
  const waiting: (() => void)[] = [];
  return async (task) => {
    if (running < max) running += 1;
    else await new Promise<void>((resolve) => waiting.push(resolve));
    try {
      return await task();
    } finally {
      const next = waiting.shift();
      if (next) next();
      else running -= 1;
    }
  };
}
