import type { RunRequest } from '@tracker/shared';

// An answer may land after a read that already has the request ended, so a request only moves on
// from open, never back.
export function withRequest(have: RunRequest[] | undefined, answered: RunRequest): RunRequest[] {
  const list = have ?? [];
  const known = list.find(({ id }) => id === answered.id);
  if (!known) return [...list, answered];
  if (known.status !== 'open') return list;
  return list.map((request) => (request.id === answered.id ? answered : request));
}
