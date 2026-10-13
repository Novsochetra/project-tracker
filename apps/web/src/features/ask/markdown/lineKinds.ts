import type { HeadingLevel } from './types';

// Quotes and lists deeper than this are text, so "> > > …" can't nest thousands of levels.
export const MAX_DEPTH = 8;

// Every pattern is anchored at the line's start and can't backtrack far, so a long line is read
// in linear time.
const FENCE_OPEN = /^( {0,3})(`{3,}|~{3,})(.*)$/;
const FENCE_CLOSE = /^ {0,3}(`{3,}|~{3,})[ \t]*$/;
const HEADING = /^ {0,3}(#{1,6})(?=[ \t]|$)/;
export const QUOTE = /^ {0,3}> ?/;
const LIST_ITEM = /^( {0,3})(?:([-*+])|(\d{1,9})[.)])([ \t]+|$)/;
const RULE = /^(?:-{3,}|\*{3,}|_{3,})$/;

export interface Fence {
  indent: number;
  marker: string;
  lang: string;
}

export interface ItemStart {
  ordered: boolean;
  number: number;
  // Where the item's text starts: lines indented this far belong to the item.
  indent: number;
}

export const isBlank = (line: string): boolean => line.trim() === '';

export const leadingSpaces = (line: string): number => /^ */.exec(line)![0].length;

export function fenceOf(line: string): Fence | null {
  const [, indent = '', marker = '', info = ''] = FENCE_OPEN.exec(line) ?? [];
  if (!marker || (marker.startsWith('`') && info.includes('`'))) return null;
  return { indent: indent.length, marker, lang: info.trim().split(/\s/, 1)[0] ?? '' };
}

export function closesFence(line: string, fence: Fence): boolean {
  const marker = FENCE_CLOSE.exec(line)?.[1];
  return !!marker && marker[0] === fence.marker[0] && marker.length >= fence.marker.length;
}

function withoutClosingHashes(text: string): string {
  let end = text.length;
  while (end > 0 && text[end - 1] === '#') end -= 1;
  if (end === 0) return '';
  return end < text.length && /[ \t]/.test(text[end - 1]!) ? text.slice(0, end).trimEnd() : text;
}

export function headingOf(line: string): { level: HeadingLevel; text: string } | null {
  const match = HEADING.exec(line);
  if (!match) return null;
  const text = withoutClosingHashes(line.slice(match[0].length).trim());
  return { level: match[1]!.length as HeadingLevel, text };
}

export const isRule = (line: string): boolean =>
  leadingSpaces(line) < 4 && RULE.test(line.replace(/[ \t]/g, ''));

export function itemOf(line: string): ItemStart | null {
  const match = LIST_ITEM.exec(line);
  if (!match) return null;
  const [, lead = '', bullet, digits, gap = ''] = match;
  const marker = lead.length + (bullet?.length ?? digits!.length + 1);
  // Text more than 4 spaces past the marker keeps its extra spaces, as in Markdown.
  const indent = gap.length === 0 || gap.length > 4 ? marker + 1 : marker + gap.length;
  return { ordered: digits !== undefined, number: Number(digits ?? 1), indent };
}

export const startsBlock = (line: string, depth: number): boolean =>
  !!fenceOf(line) ||
  HEADING.test(line) ||
  isRule(line) ||
  (depth < MAX_DEPTH && (QUOTE.test(line) || LIST_ITEM.test(line)));
