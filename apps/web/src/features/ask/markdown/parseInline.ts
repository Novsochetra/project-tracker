import { buildInline } from './buildInline';
import { codeSpans } from './codeSpans';
import { linkTokens } from './linkTokens';
import { splitMarks } from './marks';
import { matchMarks } from './matchMarks';
import type { Token } from './tokens';
import type { Inline } from './types';

// Code spans first and then links, as in Markdown, so marks inside them stay as written.
function tokensOf(source: string): Token[] {
  const tokens: Token[] = [];
  for (const piece of codeSpans(source)) {
    if (piece.kind === 'code') {
      tokens.push({ kind: 'atom', inline: { kind: 'code', text: piece.text } });
      continue;
    }
    for (const token of linkTokens(source, piece.start, piece.end)) {
      if (token.kind === 'atom') tokens.push(token);
      else for (const part of splitMarks(source, token)) tokens.push(part);
    }
  }
  return tokens;
}

// Plain text, like most table cells, needs no tokens.
const SYNTAX = /[`*_\\[]|:\/\//;

export function parseInline(source: string): Inline[] {
  if (!SYNTAX.test(source)) return source ? [{ kind: 'text', text: source }] : [];
  const tokens = tokensOf(source);
  matchMarks(tokens);
  return buildInline(tokens);
}
