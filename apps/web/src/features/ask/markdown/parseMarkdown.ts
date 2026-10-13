import { readList, readQuote } from './containerBlocks';
import type { Cursor } from './cursor';
import { readFence, readHeading, readParagraph, readRule, readTable } from './leafBlocks';
import { isBlank } from './lineKinds';
import type { Block } from './types';

// A rule comes before a list, so "- - -" is a rule, as in Markdown.
const READERS = [readFence, readHeading, readRule, readQuote, readList, readTable];

function nextBlock(cursor: Cursor): Block {
  for (const read of READERS) {
    const block = read(cursor);
    if (block) return block;
  }
  return readParagraph(cursor);
}

function parseBlocks(lines: readonly string[], depth: number): Block[] {
  const cursor: Cursor = { lines, at: 0, depth, parse: parseBlocks };
  const blocks: Block[] = [];
  while (cursor.at < lines.length) {
    if (isBlank(lines[cursor.at]!)) cursor.at += 1;
    else blocks.push(nextBlock(cursor));
  }
  return blocks;
}

// Each line is read a few times at most per level, and levels stop at MAX_DEPTH, so any answer
// parses in linear time.
export const parseMarkdown = (text: string): Block[] =>
  parseBlocks(text.replace(/\r\n?/g, '\n').split('\n'), 0);
