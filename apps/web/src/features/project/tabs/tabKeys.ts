const MOVES: Readonly<Record<string, (index: number, count: number) => number>> = {
  ArrowRight: (index, count) => (index + 1) % count,
  ArrowLeft: (index, count) => (index - 1 + count) % count,
  Home: () => 0,
  End: (_index, count) => count - 1,
};

export function tabIndexForKey(key: string, index: number, count: number): number | null {
  const move = MOVES[key];
  return move && count > 0 ? move(index, count) : null;
}
