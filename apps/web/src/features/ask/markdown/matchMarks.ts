import type { Mark, MarkToken, Token } from './tokens';

const OTHER: Record<Mark, Mark> = { '*': '_', _: '*' };

// A closer takes the nearest opener of its mark. Openers of the other mark that came after that
// opener can no longer close, or the two would cross, so they become text. Every step uses up a
// character or an opener, so any text matches in linear time.
function close(closer: MarkToken, own: MarkToken[], other: MarkToken[]): void {
  while (closer.left > 0) {
    const opener = own.at(-1);
    if (!opener) return;
    while ((other.at(-1)?.start ?? -1) > opener.start) other.pop();
    const kind = closer.left >= 2 && opener.left >= 2 ? 'strong' : 'em';
    const used = kind === 'strong' ? 2 : 1;
    opener.left -= used;
    closer.left -= used;
    opener.opens.push(kind);
    closer.closes.push(kind);
    if (opener.left === 0) own.pop();
  }
}

export function matchMarks(tokens: readonly Token[]): void {
  const stacks: Record<Mark, MarkToken[]> = { '*': [], _: [] };
  for (const token of tokens) {
    if (token.kind !== 'mark') continue;
    if (token.canClose) close(token, stacks[token.char], stacks[OTHER[token.char]]);
    if (token.left > 0 && token.canOpen) stacks[token.char].push(token);
  }
}
