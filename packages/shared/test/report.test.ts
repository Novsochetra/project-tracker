import { describe, expect, it } from 'vitest';
import type { StatusCategory } from '../src/domain/status';
import { normalizeReportStatus, parseReport } from '../src/logic/report';

const FENCE = '```';

const lines = (...parts: string[]) => parts.join('\n');

describe('normalizeReportStatus', () => {
  it.each<[string, StatusCategory]>([
    ['not started', 'todo'],
    ['Not started yet', 'todo'],
    ['to do', 'todo'],
    ['todo', 'todo'],
    ['TODO', 'todo'],
    ['in progress', 'in_progress'],
    ['In Progress', 'in_progress'],
    ['blocked', 'in_progress'],
    ['Blocked on the API key', 'in_progress'],
    ['wip', 'in_progress'],
    ['partial', 'in_progress'],
    ['started', 'in_progress'],
    ['ongoing', 'in_progress'],
    ['done', 'in_review'],
    ['DONE', 'in_review'],
    ['Done.', 'in_review'],
    ['Fixed ✅', 'in_review'],
    ['complete', 'in_review'],
    ['completed', 'in_review'],
    ['finished', 'in_review'],
    ['resolved', 'in_review'],
    ['needs review', 'in_review'],
    ['need review', 'in_review'],
    ['ready for review', 'in_review'],
    ['in review', 'in_review'],
    ['review', 'in_review'],
    ['approved', 'reviewed'],
    ['Approved by QA', 'reviewed'],
    ['reviewed', 'reviewed'],
    ['verified', 'reviewed'],
  ])('maps %j to %s', (raw, category) => {
    expect(normalizeReportStatus(raw)).toBe(category);
  });

  it.each(['', 'maybe', 'unknown', 'n/a', 'cancelled', 'undone', 'abandoned'])(
    'returns null for %j',
    (raw) => {
      expect(normalizeReportStatus(raw)).toBeNull();
    },
  );

  it('checks reviewed words before done words', () => {
    expect(normalizeReportStatus('done and verified')).toBe('reviewed');
  });

  it('checks done words before progress words', () => {
    expect(normalizeReportStatus('started, partially done')).toBe('in_review');
  });

  it('checks not started before started', () => {
    expect(normalizeReportStatus('not started')).toBe('todo');
  });

  it('never returns done, because a report never sets Done', () => {
    const words = ['done', 'complete', 'fixed', 'finished', 'resolved', 'approved', 'shipped'];

    for (const word of words) expect(normalizeReportStatus(word)).not.toBe('done');
  });
});

describe('parseReport', () => {
  it('returns no blocks for blank input', () => {
    expect(parseReport('')).toEqual([]);
    expect(parseReport('   \n\n \t ')).toEqual([]);
    expect(parseReport(lines(FENCE, FENCE))).toEqual([]);
  });

  it('parses a single block with its key, category and text', () => {
    const text = lines(
      'TICKET: MOB-3',
      'STATUS: done',
      'SUMMARY: Fixed the crash.',
      'FILES: src/profile.tsx',
      'NEXT: none',
    );

    expect(parseReport(text)).toEqual([{ key: 'MOB-3', category: 'in_review', text }]);
  });

  it('drops code fence lines', () => {
    const text = lines('```', 'TICKET: MOB-3', 'STATUS: done', '  ```text', '```');

    expect(parseReport(text)).toEqual([
      { key: 'MOB-3', category: 'in_review', text: lines('TICKET: MOB-3', 'STATUS: done') },
    ]);
  });

  it('removes carriage returns', () => {
    expect(parseReport('TICKET: MOB-3\r\nSTATUS: wip\r\n')).toEqual([
      { key: 'MOB-3', category: 'in_progress', text: lines('TICKET: MOB-3', 'STATUS: wip') },
    ]);
  });

  it('reads a TICKET label in Markdown bold', () => {
    const [block] = parseReport(lines('**TICKET:** MOB-2', '**STATUS:** done'));

    expect(block).toEqual({
      key: 'MOB-2',
      category: 'in_review',
      text: lines('TICKET: MOB-2', '**STATUS:** done'),
    });
  });

  it('reads a bold TICKET label inside a code fence', () => {
    const [block] = parseReport(lines(FENCE, '**TICKET:** MOB-2', 'STATUS: done', FENCE));

    expect(block?.key).toBe('MOB-2');
    expect(block?.category).toBe('in_review');
  });

  it.each([
    '> TICKET: mob-2',
    '- TICKET: MOB-2',
    '* TICKET: MOB-2',
    '## TICKET: MOB-2',
    '  TICKET: MOB-2',
    '**TICKET**: MOB-2',
    '_TICKET_: MOB-2',
    'TICKET: `MOB-2`',
    'TICKET: **MOB-2**',
    '> - **TICKET:** mob-2',
    'Ticket: MOB-2',
    'TICKET : MOB-2',
    'TICKET:MOB-2',
    'TICKET：MOB-2',
    'TICKET： MOB-2',
  ])('starts a block at %j', (line) => {
    expect(parseReport(lines(line, 'STATUS: done'))[0]?.key).toBe('MOB-2');
  });

  it('accepts a full-width colon after STATUS', () => {
    expect(parseReport(lines('TICKET：MOB-2', 'STATUS：blocked'))[0]?.category).toBe('in_progress');
  });

  it('uppercases the key', () => {
    expect(parseReport('ticket: mob2-14')[0]?.key).toBe('MOB2-14');
  });

  it('saves the TICKET line without *, _ and `', () => {
    const [block] = parseReport(lines('> **TICKET:** mob-2 _(login `fix`)_', 'STATUS: done'));

    expect(block?.text).toBe(lines('> TICKET: mob-2 (login fix)', 'STATUS: done'));
  });

  it('keeps Markdown on the other lines of the block', () => {
    const [block] = parseReport(lines('TICKET: MOB-2', 'SUMMARY: **Bold** `code` _it_'));

    expect(block?.text).toBe(lines('TICKET: MOB-2', 'SUMMARY: **Bold** `code` _it_'));
  });

  it('does not start a block at TICKET in the middle of a sentence', () => {
    expect(parseReport('See TICKET: MOB-2 for details')).toEqual([
      { key: null, category: null, text: 'See TICKET: MOB-2 for details' },
    ]);
  });

  it('does not start a block at TICKET without a ticket key', () => {
    expect(parseReport(lines('TICKET: none', 'STATUS: done'))).toEqual([
      { key: null, category: 'in_review', text: lines('TICKET: none', 'STATUS: done') },
    ]);
  });

  it('ignores the lines before the first TICKET line when blocks have keys', () => {
    const text = lines('All done! Here is my report.', '', 'TICKET: MOB-2', 'STATUS: done');

    expect(parseReport(text)).toEqual([
      { key: 'MOB-2', category: 'in_review', text: lines('TICKET: MOB-2', 'STATUS: done') },
    ]);
  });

  it('uses the whole text as one keyless block when there is no TICKET line', () => {
    const text = lines('', 'Fixed the crash on rotate.', 'STATUS: done', '');

    expect(parseReport(text)).toEqual([
      {
        key: null,
        category: 'in_review',
        text: lines('Fixed the crash on rotate.', 'STATUS: done'),
      },
    ]);
  });

  it('leaves the category empty without a STATUS line', () => {
    expect(parseReport(lines('TICKET: MOB-2', 'SUMMARY: Looked into it.'))[0]?.category).toBeNull();
    expect(parseReport('Just a note.')).toEqual([
      { key: null, category: null, text: 'Just a note.' },
    ]);
  });

  it.each<[string, StatusCategory | null]>([
    ['not started', 'todo'],
    ['blocked', 'in_progress'],
    ['wip', 'in_progress'],
    ['in progress', 'in_progress'],
    ['Fixed ✅', 'in_review'],
    ['done', 'in_review'],
    ['approved', 'reviewed'],
    ['reviewed', 'reviewed'],
    ['to do', 'todo'],
    ['maybe later', null],
  ])('maps STATUS: %s to %s', (word, category) => {
    expect(parseReport(lines('TICKET: MOB-2', `STATUS: ${word}`))[0]?.category).toBe(category);
  });

  it('reads the STATUS label in Markdown', () => {
    expect(parseReport(lines('TICKET: MOB-2', '- **STATUS**: In progress'))[0]?.category).toBe(
      'in_progress',
    );
  });

  it('reads the first STATUS line of a block', () => {
    const text = lines('TICKET: MOB-2', 'STATUS: blocked', 'STATUS: done');

    expect(parseReport(text)[0]?.category).toBe('in_progress');
  });

  it('keeps several blocks in order, each with its own text and status', () => {
    const text = lines(
      'TICKET: WEB-1',
      'STATUS: done',
      'SUMMARY: A',
      '',
      'TICKET: MOB-2',
      'STATUS: blocked',
      'SUMMARY: B',
      '',
      'TICKET: WEB-1',
      'SUMMARY: C',
    );

    expect(parseReport(text)).toEqual([
      {
        key: 'WEB-1',
        category: 'in_review',
        text: lines('TICKET: WEB-1', 'STATUS: done', 'SUMMARY: A'),
      },
      {
        key: 'MOB-2',
        category: 'in_progress',
        text: lines('TICKET: MOB-2', 'STATUS: blocked', 'SUMMARY: B'),
      },
      { key: 'WEB-1', category: null, text: lines('TICKET: WEB-1', 'SUMMARY: C') },
    ]);
  });

  it('parses the acceptance reply: one block for MOB-2 and one for the unknown MOB-9', () => {
    const reply = lines(
      'Both tickets are handled.',
      '',
      FENCE,
      'TICKET: MOB-2',
      'STATUS: done',
      'SUMMARY: Added the inline error under the password field.',
      'FILES: src/login.tsx',
      'NEXT: none',
      FENCE,
      '',
      FENCE,
      'TICKET: MOB-9',
      'STATUS: done',
      'SUMMARY: Nothing to change.',
      'FILES: none',
      'NEXT: none',
      FENCE,
    );

    expect(parseReport(reply)).toEqual([
      {
        key: 'MOB-2',
        category: 'in_review',
        text: lines(
          'TICKET: MOB-2',
          'STATUS: done',
          'SUMMARY: Added the inline error under the password field.',
          'FILES: src/login.tsx',
          'NEXT: none',
        ),
      },
      {
        key: 'MOB-9',
        category: 'in_review',
        text: lines(
          'TICKET: MOB-9',
          'STATUS: done',
          'SUMMARY: Nothing to change.',
          'FILES: none',
          'NEXT: none',
        ),
      },
    ]);
  });
});
