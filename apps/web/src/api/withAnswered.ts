// An answer may land after a read that already has the question ended, so a question only moves
// on from open, never back.
export function withAnswered<T extends { id: string; status: string }>(
  have: T[] | undefined,
  answered: T,
): T[] {
  const list = have ?? [];
  const known = list.find(({ id }) => id === answered.id);
  if (!known) return [...list, answered];

  if (known.status !== 'open') return list;

  return list.map((item) => (item.id === answered.id ? answered : item));
}
