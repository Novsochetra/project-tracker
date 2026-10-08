// Kept per writer, so one QueryClient going idle does not hide another one's writes.
const writers = new Set<object>();

export function setPendingWrites(writer: object, pending: boolean): void {
  if (pending) writers.add(writer);
  else writers.delete(writer);
}

export const hasPendingWrites = (): boolean => writers.size > 0;
