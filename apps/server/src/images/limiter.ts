// Runs tasks while their costs fit in `capacity` together, the rest in turn. A task bigger than
// the capacity runs alone, so the total stays within the capacity or that one task.
export type WorkLimiter = <T>(cost: number, task: () => Promise<T>) => Promise<T>;

export type Limiter = <T>(task: () => Promise<T>) => Promise<T>;

interface Waiting {
  cost: number;
  start: () => void;
}

export function createWorkLimiter(capacity: number): WorkLimiter {
  let used = 0;
  const waiting: Waiting[] = [];
  const fits = (cost: number) => used === 0 || used + cost <= capacity;
  // In order: a small task never passes a big one waiting for room, which would starve it.
  const startWaiting = () => {
    for (let next = waiting[0]; next && fits(next.cost); next = waiting[0]) {
      waiting.shift();
      used += next.cost;
      next.start();
    }
  };
  return async (cost, task) => {
    if (waiting.length === 0 && fits(cost)) used += cost;
    else await new Promise<void>((start) => waiting.push({ cost, start }));
    try {
      return await task();
    } finally {
      used -= cost;
      startWaiting();
    }
  };
}

export function createLimiter(max: number): Limiter {
  const limit = createWorkLimiter(max);
  return (task) => limit(1, task);
}
