import type { Inline } from './types';

export type Emphasis = 'strong' | 'em';
export type Mark = '*' | '_';

export interface TextToken {
  kind: 'text';
  text: string;
  // Where the text starts in the source, so a mark can look at the characters around it.
  start: number;
}

export interface AtomToken {
  kind: 'atom';
  inline: Inline;
}

export interface MarkToken {
  kind: 'mark';
  char: Mark;
  start: number;
  // The characters of the run that no emphasis used: they show as text.
  left: number;
  canOpen: boolean;
  canClose: boolean;
  // Innermost first, in the order they were matched.
  opens: Emphasis[];
  closes: Emphasis[];
}

export type Token = TextToken | AtomToken | MarkToken;
