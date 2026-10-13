import { expect, it } from 'vitest';
import { parseMarkdown } from './parseMarkdown';

// Answers take up to 100,000 characters, and a parser that backtracks or rescans goes quadratic
// on text like these: seconds of a frozen page. Linear parsing takes milliseconds; a loaded
// machine can stretch that, so the budget is wide.
const SIZE = 100_000;
const BUDGET_MS = 1_000;

const fill = (unit: string, prefix = '', suffix = ''): string =>
  prefix + unit.repeat(Math.ceil((SIZE - prefix.length - suffix.length) / unit.length)) + suffix;

const nestedList = Array.from(
  { length: 2_000 },
  (_, index) => `${' '.repeat((index % 40) * 2)}- item ${index}`,
).join('\n');

const mixed = [
  '## Heading',
  'Some **bold**, *italic*, `code` and https://x.dev/a.',
  '- one\n- two\n  1. nested',
  '> quoted',
  '| a | b |\n|---|--:|\n| 1 | 2 |',
  '```ts\nconst a = 1;\n```',
].join('\n\n');

it.each([
  ['unclosed stars', fill('*a ')],
  ['unclosed underscores', fill(' _a')],
  ['stars of both kinds', fill('*a _b ')],
  ['one long run of stars', fill('*', 'a ', ' b')],
  ['backticks of growing length', fill('` `` ``` ```` ')],
  ['open brackets', fill('[')],
  ['links that never close', fill('[a](https://x.dev/')],
  ['labels with no address', fill('[a]')],
  ['trailing brackets after an address', fill(')', 'https://x.dev/')],
  ['nested quotes', fill('> ')],
  ['nested bullets', fill('- ')],
  ['nested numbers', fill('1. ')],
  ['a heading of spaces', fill(' ', '# ', 'x')],
  ['a rule-like line', fill('- ', '', 'x')],
  ['pipes', fill('|')],
  ['a table head with many cells', fill('|a', '', '\n') + fill('|-')],
  ['many short lines', fill('a\n')],
  ['many fences', fill('```\n')],
  ['a deep list', fill(`${nestedList}\n`).slice(0, SIZE)],
  ['a long mixed answer', fill(`${mixed}\n\n`).slice(0, SIZE)],
])('parses %s of 100,000 characters in time', (_name, text) => {
  const start = performance.now();
  parseMarkdown(text);
  expect(performance.now() - start).toBeLessThan(BUDGET_MS);
});
