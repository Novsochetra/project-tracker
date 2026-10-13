import { describe, expect, it } from 'vitest';
import { MAX_DEPTH } from './lineKinds';
import { parseMarkdown } from './parseMarkdown';
import { MAX_TABLE_CELLS } from './table';
import type { Block, Inline } from './types';

const text = (value: string): Inline => ({ kind: 'text', text: value });
const paragraph = (value: string): Block => ({ kind: 'paragraph', content: [text(value)] });

describe('parseMarkdown', () => {
  it('reads paragraphs and keeps their line ends', () => {
    expect(parseMarkdown('one\n  two\n\nthree')).toEqual([
      paragraph('one\ntwo'),
      paragraph('three'),
    ]);
  });

  it('reads headings of every level', () => {
    expect(parseMarkdown('# One\n## Two ##\n###### Six\n####### Seven\n#nospace')).toEqual([
      { kind: 'heading', level: 1, content: [text('One')] },
      { kind: 'heading', level: 2, content: [text('Two')] },
      { kind: 'heading', level: 6, content: [text('Six')] },
      paragraph('####### Seven\n#nospace'),
    ]);
  });

  it('reads fenced code with its language and keeps its text as written', () => {
    const answer = 'Run:\n```ts\nconst a = **b**;\n  <b>x</b>\n```\nDone.';
    expect(parseMarkdown(answer)).toEqual([
      paragraph('Run:'),
      { kind: 'code', lang: 'ts', text: 'const a = **b**;\n  <b>x</b>' },
      paragraph('Done.'),
    ]);
  });

  it('closes a fence only with one at least as long, and runs an unclosed one to the end', () => {
    expect(parseMarkdown('````\n```\ninner\n```\n````')).toEqual([
      { kind: 'code', lang: '', text: '```\ninner\n```' },
    ]);
    expect(parseMarkdown('~~~\nopen')).toEqual([{ kind: 'code', lang: '', text: 'open' }]);
  });

  it('reads bulleted and numbered lists, nested and loose', () => {
    const answer = '1. First\n   more\n2. Second\n   - a\n   - b\n\n3. Third\nlazy';
    expect(parseMarkdown(answer)).toEqual([
      {
        kind: 'list',
        ordered: true,
        start: 1,
        items: [
          [paragraph('First\nmore')],
          [
            paragraph('Second'),
            { kind: 'list', ordered: false, start: 1, items: [[paragraph('a')], [paragraph('b')]] },
          ],
          [paragraph('Third\nlazy')],
        ],
      },
    ]);
  });

  it('starts a numbered list at its first number, and ends a list where its kind changes', () => {
    expect(parseMarkdown('3) c\n4) d\n- e')).toEqual([
      { kind: 'list', ordered: true, start: 3, items: [[paragraph('c')], [paragraph('d')]] },
      { kind: 'list', ordered: false, start: 1, items: [[paragraph('e')]] },
    ]);
  });

  it('lets a list start right under a paragraph', () => {
    expect(parseMarkdown('Steps:\n- one')).toEqual([
      paragraph('Steps:'),
      { kind: 'list', ordered: false, start: 1, items: [[paragraph('one')]] },
    ]);
  });

  it('reads quotes, which hold blocks of their own', () => {
    expect(parseMarkdown('> # Note\n> said\n>\n> - x')).toEqual([
      {
        kind: 'quote',
        blocks: [
          { kind: 'heading', level: 1, content: [text('Note')] },
          paragraph('said'),
          { kind: 'list', ordered: false, start: 1, items: [[paragraph('x')]] },
        ],
      },
    ]);
  });

  it('reads rules, also before a list', () => {
    expect(parseMarkdown('a\n\n---\n* * *\n- - -')).toEqual([
      paragraph('a'),
      { kind: 'rule' },
      { kind: 'rule' },
      { kind: 'rule' },
    ]);
  });

  it('reads tables with alignment, escaped pipes, and rows cut to the head but never padded', () => {
    const answer =
      'Before\n| Name | Size | Note |\n|:--|--:|:-:|\n| a \\| b | 1 |\n| c | 2 | x | extra |\nAfter';
    expect(parseMarkdown(answer)).toEqual([
      paragraph('Before'),
      {
        kind: 'table',
        align: ['left', 'right', 'center'],
        head: [[text('Name')], [text('Size')], [text('Note')]],
        rows: [
          [[text('a | b')], [text('1')]],
          [[text('c')], [text('2')], [text('x')]],
        ],
      },
      paragraph('After'),
    ]);
  });

  it('shows rows past the cell cap as text', () => {
    const rows = Array.from({ length: MAX_TABLE_CELLS }, (_, index) => `| ${index} |`);
    const [table, rest] = parseMarkdown(`| n |\n|---|\n${rows.join('\n')}`);
    expect(table?.kind === 'table' && table.rows.length).toBe(MAX_TABLE_CELLS - 1);
    expect(rest).toEqual(paragraph(`| ${MAX_TABLE_CELLS - 1} |`));
  });

  it('shows a table whose head passes the cell cap as text', () => {
    const wide = `|${' a |'.repeat(MAX_TABLE_CELLS + 1)}\n|${'-|'.repeat(MAX_TABLE_CELLS + 1)}`;
    expect(parseMarkdown(wide).map((block) => block.kind)).toEqual(['paragraph']);
  });

  it('needs as many dashes cells as header cells for a table', () => {
    expect(parseMarkdown('a | b\n--- | --- | ---')).toEqual([paragraph('a | b\n--- | --- | ---')]);
  });

  it('keeps HTML as text', () => {
    expect(parseMarkdown('<script>alert(1)</script>')).toEqual([
      paragraph('<script>alert(1)</script>'),
    ]);
  });

  it('shows quotes deeper than the limit as text', () => {
    let blocks = parseMarkdown('> '.repeat(MAX_DEPTH + 3) + 'x');
    let levels = 0;
    while (blocks[0]?.kind === 'quote') {
      blocks = blocks[0].blocks;
      levels += 1;
    }
    expect(levels).toBe(MAX_DEPTH);
    expect(blocks).toEqual([paragraph('> > > x')]);
  });

  it('reads Windows line ends', () => {
    expect(parseMarkdown('# A\r\nb\r\n')).toEqual([
      { kind: 'heading', level: 1, content: [text('A')] },
      paragraph('b'),
    ]);
  });
});
