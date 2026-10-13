// An answer may land after a read that already has the request ended, so a request only moves on
// from open, never back. Ticket questions are answered the same way.
export function withRequest<T extends { id: string; status: string }>(
  have: T[] | undefined,
  answered: T,
): T[] {
  const list = have ?? [];
  const known = list.find(({ id }) => id === answered.id);
  if (!known) return [...list, answered];
  if (known.status !== 'open') return list;
  return list.map((request) => (request.id === answered.id ? answered : request));
}
