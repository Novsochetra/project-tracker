import { describe, expect, it } from 'vitest';
import { parseCliArgs, prepareCommand, UsageError } from '../../src/cli/args';
import { addComment } from '../../src/tools/addComment';
import { attachFile } from '../../src/tools/attachFile';
import { claimNextTicket } from '../../src/tools/claimNextTicket';
import { claimTicket } from '../../src/tools/claimTicket';
import { createTicket } from '../../src/tools/createTicket';
import { getTicket } from '../../src/tools/getTicket';
import { listProjects } from '../../src/tools/listProjects';
import { listStatuses } from '../../src/tools/listStatuses';
import { listTickets } from '../../src/tools/listTickets';
import { moveTicket } from '../../src/tools/moveTicket';
import { reviewTicket } from '../../src/tools/reviewTicket';
import { submitForReview } from '../../src/tools/submitForReview';
import { updateTicket } from '../../src/tools/updateTicket';

const prepare = (...argv: string[]) => prepareCommand(parseCliArgs(argv));

function usageError(argv: string[]): UsageError {
  try {
    prepare(...argv);
  } catch (error) {
    if (error instanceof UsageError) return error;
    throw error;
  }
  throw new Error(`Expected a usage error for: ${argv.join(' ')}`);
}

describe('parseCliArgs', () => {
  it('splits the command, its arguments, global flags and command options', () => {
    const argv = [
      '--url',
      'http://x:1',
      'tickets',
      'MOB',
      '--as',
      'Bot',
      '--json',
      '--status',
      'To do',
    ];
    expect(parseCliArgs(argv)).toEqual({
      command: 'tickets',
      args: ['MOB'],
      global: {
        url: 'http://x:1',
        as: 'Bot',
        token: undefined,
        json: true,
        help: false,
        version: false,
      },
      options: { status: 'To do' },
      flags: {},
    });
  });

  it('reads --token and -h', () => {
    expect(parseCliArgs(['-h', '--token', 'secret']).global).toMatchObject({
      token: 'secret',
      help: true,
    });
  });

  it('reports unknown options and missing values as usage errors', () => {
    expect(() => parseCliArgs(['projects', '--nope'])).toThrow(UsageError);
    expect(() => parseCliArgs(['create', 'MOB', '--title'])).toThrow(UsageError);
  });
});

describe('prepareCommand', () => {
  it('projects', () => {
    expect(prepare('projects')).toEqual({ tool: listProjects, input: {} });
  });

  it('statuses <PROJECT>', () => {
    expect(prepare('statuses', 'mob')).toEqual({ tool: listStatuses, input: { project: 'MOB' } });
  });

  it('tickets <PROJECT> with filters', () => {
    const argv = [
      'tickets',
      'MOB',
      '--status',
      'In progress',
      '--category',
      'in_progress',
      '--query',
      'crash',
    ];
    expect(prepare(...argv)).toEqual({
      tool: listTickets,
      input: { project: 'MOB', status: 'In progress', category: 'in_progress', query: 'crash' },
    });
  });

  it('show <KEY>', () => {
    expect(prepare('show', 'mob-3')).toEqual({ tool: getTicket, input: { ticket: 'MOB-3' } });
  });

  it('create <PROJECT> with every option', () => {
    const argv = [
      'create',
      'MOB',
      '--title',
      'Crash',
      '--description',
      'Steps',
      '--priority',
      'high',
      '--status',
      'To do',
    ];
    expect(prepare(...argv)).toEqual({
      tool: createTicket,
      input: {
        project: 'MOB',
        title: 'Crash',
        description: 'Steps',
        priority: 'high',
        status: 'To do',
      },
    });
  });

  it('update <KEY>, where an empty value clears a field', () => {
    const argv = [
      'update',
      'MOB-3',
      '--title',
      'New',
      '--priority',
      'low',
      '--assignee',
      '',
      '--due',
      '',
    ];
    expect(prepare(...argv)).toEqual({
      tool: updateTicket,
      input: { ticket: 'MOB-3', title: 'New', priority: 'low', assignee: '', due: '' },
    });
    expect(
      prepare('update', 'MOB-3', '--description', 'More', '--due', '2026-10-09').input,
    ).toEqual({
      ticket: 'MOB-3',
      description: 'More',
      due: '2026-10-09',
    });
  });

  it('--label names labels, comma-separated, and an empty one clears them on update', () => {
    expect(prepare('create', 'MOB', '--title', 'Crash', '--label', 'Bug, UI').input).toEqual({
      project: 'MOB',
      title: 'Crash',
      labels: ['Bug', 'UI'],
    });
    expect(prepare('update', 'MOB-3', '--label', '').input).toEqual({
      ticket: 'MOB-3',
      labels: [],
    });
    expect(prepare('tickets', 'MOB', '--label', 'bug').input).toEqual({
      project: 'MOB',
      label: 'bug',
    });
  });

  it('move <KEY> <STATUS NAME…> joins the words of the status', () => {
    expect(prepare('move', 'MOB-3', 'Need', 'review')).toEqual({
      tool: moveTicket,
      input: { ticket: 'MOB-3', status: 'Need review' },
    });
  });

  it('comment <KEY> <TEXT…> joins the words of the text', () => {
    expect(prepare('comment', 'MOB-3', 'Blocked', 'on', 'the', 'API')).toEqual({
      tool: addComment,
      input: { ticket: 'MOB-3', text: 'Blocked on the API' },
    });
  });

  it('attach <KEY> <FILE…> takes every file, and --comment', () => {
    expect(prepare('attach', 'mob-3', 'notes.md', 'out/data.csv')).toEqual({
      tool: attachFile,
      input: { ticket: 'MOB-3', paths: ['notes.md', 'out/data.csv'] },
    });
    expect(prepare('attach', 'MOB-3', 'a.png', '--comment', 'The chart')).toEqual({
      tool: attachFile,
      input: { ticket: 'MOB-3', paths: ['a.png'], comment: 'The chart' },
    });
    expect(usageError(['attach', 'MOB-3']).message).toBe('Missing <FILE>.');
  });

  it('claim <PROJECT> claims the next ticket and claim <KEY> a specific one', () => {
    expect(prepare('claim', 'mob')).toEqual({ tool: claimNextTicket, input: { project: 'MOB' } });
    expect(prepare('claim', 'mob-3')).toEqual({ tool: claimTicket, input: { ticket: 'MOB-3' } });
  });

  it('submit <KEY>', () => {
    const argv = ['submit', 'MOB-3', '--summary', 'Fixed it', '--files', 'a.ts', '--next', 'none'];
    expect(prepare(...argv)).toEqual({
      tool: submitForReview,
      input: { ticket: 'MOB-3', summary: 'Fixed it', files: 'a.ts', next: 'none' },
    });
    expect(prepare(...argv, '--output', 'draft.md')).toEqual({
      tool: submitForReview,
      input: {
        ticket: 'MOB-3',
        summary: 'Fixed it',
        files: 'a.ts',
        output: 'draft.md',
        next: 'none',
      },
    });
  });

  it('review <KEY> turns the rating into a number', () => {
    const argv = [
      'review',
      'MOB-3',
      '--verdict',
      'changes_requested',
      '--rating',
      '2',
      '--summary',
      'Add tests',
    ];
    expect(prepare(...argv)).toEqual({
      tool: reviewTicket,
      input: { ticket: 'MOB-3', verdict: 'changes_requested', rating: 2, summary: 'Add tests' },
    });
  });
});

describe('usage errors', () => {
  it.each([
    [[], 'Missing command.', undefined],
    [['launch'], 'Unknown command "launch".', undefined],
    [['show'], 'Missing <KEY>.', 'show <KEY>'],
    [['move', 'MOB-3'], 'Missing <STATUS NAME>.', 'move <KEY> <STATUS NAME…>'],
    [['show', 'MOB-3', 'MOB-4'], 'Unexpected argument "MOB-4".', 'show <KEY>'],
    [['projects', '--title', 'x'], '"projects" has no --title option.', 'projects'],
    [['create', 'MOB'], 'Missing --title.', createUsage()],
    [['create', '--title', 'x'], 'Missing <PROJECT>.', createUsage()],
    [
      ['submit', 'MOB-3'],
      'Missing --summary.',
      'submit <KEY> --summary S [--files F] [--output O] [--next N]',
    ],
  ])('%j', (argv, message, usage) => {
    const error = usageError(argv);
    expect(error.message).toBe(message);
    expect(error.usage).toBe(usage);
  });

  it('reports invalid values with the field name', () => {
    expect(usageError(['create', 'MOB', '--title', 'x', '--priority', 'urgent']).message).toBe(
      'priority: Invalid option: expected one of "high"|"medium"|"low"',
    );
    expect(usageError(['show', 'MOB3']).message).toBe('ticket: Use a ticket key like MOB-3.');
    const review = [
      'review',
      'MOB-3',
      '--verdict',
      'approved',
      '--rating',
      'five',
      '--summary',
      'ok',
    ];
    expect(usageError(review).message).toBe('rating: Rating must be a whole number from 1 to 5.');
  });
});

function createUsage(): string {
  return 'create <PROJECT> --title T [--description D] [--priority high|medium|low] [--status NAME] [--label "A, B"]';
}
