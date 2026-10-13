import type { Block } from './types';

export interface Cursor {
  lines: readonly string[];
  at: number;
  depth: number;
  // Passed in rather than imported, so parseMarkdown and the readers don't import each other.
  parse: (lines: readonly string[], depth: number) => Block[];
}
