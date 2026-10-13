import type { Cursor } from './cursor';
import {
  isBlank,
  itemOf,
  leadingSpaces,
  MAX_DEPTH,
  QUOTE,
  startsBlock,
  type ItemStart,
} from './lineKinds';
import type { Block } from './types';

export function readQuote(cursor: Cursor): Block | null {
  const inner: string[] = [];
  while (cursor.depth < MAX_DEPTH && cursor.at < cursor.lines.length) {
    const line = cursor.lines[cursor.at]!;
    const prefix = QUOTE.exec(line)?.[0];
    if (prefix === undefined) break;
    inner.push(line.slice(prefix.length));
    cursor.at += 1;
  }
  return inner.length ? { kind: 'quote', blocks: cursor.parse(inner, cursor.depth + 1) } : null;
}

// A line indented to the item's text belongs to it, and so does an unindented line right after
// its text that starts nothing else (a lazy line, as in Markdown).
function itemLines(cursor: Cursor, item: ItemStart): string[] {
  const { lines } = cursor;
  const out = [lines[cursor.at]!.slice(item.indent)];
  let blanks = 0;
  for (cursor.at += 1; cursor.at < lines.length; cursor.at += 1) {
    const line = lines[cursor.at]!;
    if (isBlank(line)) {
      blanks += 1;
      continue;
    }
    if (leadingSpaces(line) >= item.indent) {
      for (; blanks > 0; blanks -= 1) out.push('');
      out.push(line.slice(item.indent));
    } else if (blanks === 0 && !startsBlock(line, cursor.depth)) out.push(line.trim());
    else break;
  }
  return out;
}

// Blank lines may sit between items; the list goes on when an item of its kind follows them.
function nextItem(cursor: Cursor, ordered: boolean): ItemStart | null {
  let at = cursor.at;
  while (at < cursor.lines.length && isBlank(cursor.lines[at]!)) at += 1;
  const item = itemOf(cursor.lines[at] ?? '');
  if (item?.ordered !== ordered) return null;
  cursor.at = at;
  return item;
}

export function readList(cursor: Cursor): Block | null {
  const first = cursor.depth < MAX_DEPTH ? itemOf(cursor.lines[cursor.at] ?? '') : null;
  if (!first) return null;
  const items: Block[][] = [];
  for (let item: ItemStart | null = first; item; item = nextItem(cursor, first.ordered)) {
    items.push(cursor.parse(itemLines(cursor, item), cursor.depth + 1));
  }
  return { kind: 'list', ordered: first.ordered, start: first.number, items };
}
