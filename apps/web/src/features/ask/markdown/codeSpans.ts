export type Piece = { kind: 'code'; text: string } | { kind: 'plain'; start: number; end: number };

interface Run {
  start: number;
  length: number;
}

const backtickRuns = (text: string): Run[] =>
  Array.from(text.matchAll(/`+/g), (match) => ({ start: match.index, length: match[0].length }));

// Only the next run of the same length closes a run. Found for every run in one pass from the end,
// so text full of backticks that close nothing splits in linear time.
function closers(runs: readonly Run[]): number[] {
  const next = new Map<number, number>();
  const found: number[] = new Array<number>(runs.length).fill(-1);
  for (let i = runs.length - 1; i >= 0; i -= 1) {
    const length = runs[i]!.length;
    found[i] = next.get(length) ?? -1;
    next.set(length, i);
  }
  return found;
}

// As in Markdown, so `` `a` `` shows `a`: line ends are spaces and one space each side goes.
function codeText(raw: string): string {
  const text = raw.replace(/\n/g, ' ');
  const padded = text.length > 2 && text.startsWith(' ') && text.endsWith(' ');
  return padded && text.trim() ? text.slice(1, -1) : text;
}

export function codeSpans(text: string): Piece[] {
  const runs = backtickRuns(text);
  const close = closers(runs);
  const pieces: Piece[] = [];
  let plain = 0;
  for (let i = 0; i < runs.length; i += 1) {
    const j = close[i]!;
    if (j === -1) continue;
    const open = runs[i]!;
    const end = runs[j]!;
    if (open.start > plain) pieces.push({ kind: 'plain', start: plain, end: open.start });
    pieces.push({ kind: 'code', text: codeText(text.slice(open.start + open.length, end.start)) });
    plain = end.start + end.length;
    i = j;
  }
  if (plain < text.length) pieces.push({ kind: 'plain', start: plain, end: text.length });
  return pieces;
}
