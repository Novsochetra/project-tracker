import type { Block } from './types';

export interface Cursor {
  lines: readonly string[];
  at: number;
  depth: number;
  // Quotes and list items hold blocks of their own.
  parse: (lines: readonly string[], depth: number) => Block[];
}
