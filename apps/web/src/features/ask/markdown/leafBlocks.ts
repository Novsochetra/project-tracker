import type { Cursor } from './cursor';
import {
  closesFence,
  fenceOf,
  headingOf,
  isBlank,
  isRule,
  leadingSpaces,
  startsBlock,
} from './lineKinds';
import { parseInline } from './parseInline';
import { fitRow, splitRow, tableAt } from './table';
import type { Block } from './types';

const lineAt = (cursor: Cursor): string => cursor.lines[cursor.at] ?? '';

// A fence that never closes runs to the end, as in Markdown.
export function readFence(cursor: Cursor): Block | null {
  const fence = fenceOf(lineAt(cursor));
  if (!fence) return null;
  const body: string[] = [];
  cursor.at += 1;
  while (cursor.at < cursor.lines.length && !closesFence(lineAt(cursor), fence)) {
    const line = lineAt(cursor);
    body.push(line.slice(Math.min(fence.indent, leadingSpaces(line))));
    cursor.at += 1;
  }
  cursor.at += 1;
  return { kind: 'code', lang: fence.lang, text: body.join('\n') };
}

export function readHeading(cursor: Cursor): Block | null {
  const heading = headingOf(lineAt(cursor));
  if (!heading) return null;
  cursor.at += 1;
  return { kind: 'heading', level: heading.level, content: parseInline(heading.text) };
}

export function readRule(cursor: Cursor): Block | null {
  if (!isRule(lineAt(cursor))) return null;
  cursor.at += 1;
  return { kind: 'rule' };
}

// Rows end at a line without a pipe, so text right under a table isn't read as a row.
export function readTable(cursor: Cursor): Block | null {
  const table = tableAt(cursor.lines, cursor.at);
  if (!table) return null;
  const width = table.head.length;
  const rows: string[][] = [];
  cursor.at += 2;
  for (let line = lineAt(cursor); cursor.at < cursor.lines.length; line = lineAt(cursor)) {
    if (!line.includes('|') || startsBlock(line, cursor.depth)) break;
    rows.push(fitRow(splitRow(line), width));
    cursor.at += 1;
  }
  return {
    kind: 'table',
    align: table.align,
    head: table.head.map(parseInline),
    rows: rows.map((row) => row.map(parseInline)),
  };
}

export const endsParagraph = (cursor: Cursor): boolean => {
  const line = lineAt(cursor);
  return (
    isBlank(line) || startsBlock(line, cursor.depth) || tableAt(cursor.lines, cursor.at) !== null
  );
};

// Line ends stay, since answers written for a terminal break lines where they mean to.
export function readParagraph(cursor: Cursor): Block {
  const lines = [lineAt(cursor).trim()];
  cursor.at += 1;
  while (cursor.at < cursor.lines.length && !endsParagraph(cursor)) {
    lines.push(lineAt(cursor).trim());
    cursor.at += 1;
  }
  return { kind: 'paragraph', content: parseInline(lines.join('\n')) };
}
