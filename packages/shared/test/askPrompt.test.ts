import { describe, expect, it } from 'vitest';
import { buildAskPrompt, withSentFiles } from '../src/logic/askPrompt';
import { ticketCards } from '../src/logic/ticketCard';
import type { PromptTicket } from '../src/logic/prompt';

const project = { key: 'PT', name: 'Project Tracker' };

const ticket: PromptTicket = {
  key: 'PT-12',
  title: 'Sync drops edits',
  description: 'Edits made offline vanish.',
  priority: 'high',
  statusName: 'Need review',
  due: '',
  assignee: 'Claude',
  notes: ['Seen on iOS only'],
  lastReport: 'TICKET: PT-12\nSTATUS: done',
  lastReview: { verdict: 'changes_requested', rating: 3, text: 'Add a test.' },
};

describe('buildAskPrompt', () => {
  it('names the project, says it is read-only and ends with the question', () => {
    const prompt = buildAskPrompt({
      project,
      mode: 'ask',
      question: 'Where are runs queued?',
      history: [],
    });
    expect(prompt).toContain('"Project Tracker" (PT)');
    expect(prompt).toContain('read-only');
    expect(prompt.endsWith('Question:\nWhere are runs queued?')).toBe(true);
    expect(prompt).not.toContain('Earlier in this chat');
  });

  it('shows how to write a ticket card the parser reads', () => {
    expect(buildAskPrompt({ project, mode: 'ask', question: 'q', history: [] })).toContain(
      '````ticket\ntitle: <short title>\npriority: high | medium | low\n---',
    );
  });

  it('asks for one card per ticket only when the work is split, and the parser reads them', () => {
    const prompt = buildAskPrompt({ project, mode: 'plan', question: 'q', history: [] });
    expect(prompt).toContain('end your answer with one ticket card');
    expect(prompt).toContain('split or plan work into tickets, end with one such card per ticket');
    const example = /````ticket[\s\S]*?\n````/.exec(prompt)?.[0] ?? '';
    const filled = (title: string) =>
      example
        .replace('<short title>', title)
        .replace('high | medium | low', 'low')
        .replace(/<description[^>]*>/, '## Why\nIt helps.');
    const answer = ['Two tickets:', filled('First'), filled('Second'), 'Tap Create all.'].join(
      '\n',
    );
    expect(ticketCards(answer)).toEqual([
      { title: 'First', priority: 'low', description: '## Why\nIt helps.' },
      { title: 'Second', priority: 'low', description: '## Why\nIt helps.' },
    ]);
  });

  it('asks for every card not yet a ticket again on a change, and leaves made ones out', () => {
    const prompt = buildAskPrompt({ project, mode: 'plan', question: 'q', history: [] });
    expect(prompt).toContain(
      'When they ask for any change, send again, in order, every card that is not a ticket yet',
    );
    expect(prompt).toContain('A card marked like [card 2 → PT-14] is a ticket now: leave it out.');
  });

  const card = (title: string) => ['````ticket', `title: ${title}`, '````'].join('\n');
  const answered = [
    { role: 'person' as const, text: 'Split it' },
    {
      role: 'claude' as const,
      text: ['Two tickets:', card('First'), card('Second')].join('\n'),
      cardTickets: [{ index: 1, ticketKey: 'PT-14' }],
    },
  ];

  it('marks the cards that became tickets in the chat so far', () => {
    const prompt = buildAskPrompt({ project, mode: 'plan', question: 'q', history: answered });
    expect(prompt).toContain('title: Second\n````\n[card 2 → PT-14]\n\n---');
    expect(prompt).not.toContain('[card 1');
  });

  it('lists the made cards with their titles when the session is resumed', () => {
    const prompt = buildAskPrompt({
      project,
      mode: 'plan',
      question: 'q',
      history: answered,
      resumed: true,
    });
    expect(prompt).not.toContain('Earlier in this chat');
    expect(prompt).toContain('Your cards that are tickets now:\n[card 2 → PT-14] Second');
    const none = buildAskPrompt({
      project,
      mode: 'plan',
      question: 'q',
      history: [],
      resumed: true,
    });
    expect(none).not.toContain('Your cards');
  });

  it('puts earlier messages before the question when the session can not be resumed', () => {
    const prompt = buildAskPrompt({
      project,
      mode: 'ask',
      question: 'And the helper?',
      history: [
        { role: 'person', text: 'Where are runs queued?' },
        { role: 'claude', text: 'In runQueue.ts.' },
      ],
    });
    expect(prompt).toContain(
      'Earlier in this chat:\n\nPerson:\nWhere are runs queued?\n\nYou:\nIn runQueue.ts.',
    );
    expect(prompt.indexOf('Earlier')).toBeLessThan(prompt.indexOf('Question:'));
  });

  it('names the files sent with earlier questions, which the helper no longer has', () => {
    const prompt = buildAskPrompt({
      project,
      mode: 'ask',
      question: 'And now?',
      history: [
        { role: 'person', text: 'Turn this into tickets', files: ['board.jpg', 'notes.txt'] },
        { role: 'claude', text: 'Two tickets.', files: [] },
      ],
    });
    expect(prompt).toContain(
      'Person:\nTurn this into tickets\n(Sent with it: board.jpg, notes.txt)\n\nYou:\nTwo tickets.',
    );
  });

  it('keeps Ask and Plan read-only and plans in Plan', () => {
    const plan = buildAskPrompt({ project, mode: 'plan', question: 'q', history: [] });
    expect(plan).toContain('read-only');
    expect(plan).toContain('Make a plan');
  });

  it('never says read-only in Edit and points to the tracker workflow', () => {
    const edit = buildAskPrompt({ project, mode: 'edit', question: 'q', history: [] });
    expect(edit).not.toContain('read-only');
    expect(edit).not.toContain("can't create tickets");
    expect(edit).toContain('submit it for review');
    expect(edit).toContain('Never move a ticket to Done');
  });

  it('shows the chat ticket, its notes, report and review before the chat and the question', () => {
    const prompt = buildAskPrompt({
      project,
      mode: 'ask',
      question: 'Why does it drop them?',
      history: [{ role: 'person', text: 'Hi' }],
      ticket,
    });
    expect(prompt).toContain('This chat is about this ticket:\n\n## PT-12: Sync drops edits');
    expect(prompt).toContain('Edits made offline vanish.');
    expect(prompt).toContain('- Seen on iOS only');
    expect(prompt).toContain('Your last report on this ticket:\nTICKET: PT-12');
    expect(prompt).toContain('Last review: Changes requested · 3/5\nAdd a test.');
    expect(prompt.indexOf('## PT-12')).toBeLessThan(prompt.indexOf('Earlier in this chat'));
  });

  it('leaves the ticket out of a chat about none', () => {
    const prompt = buildAskPrompt({
      project,
      mode: 'ask',
      question: 'q',
      history: [],
      ticket: null,
    });
    expect(prompt).not.toContain('This chat is about');
  });
});

describe('withSentFiles', () => {
  it('follows a question that names its files', () => {
    const named = buildAskPrompt({
      project,
      mode: 'ask',
      question: 'Make tickets',
      files: ['board.jpg'],
      history: [],
    });
    expect(named.endsWith('Question:\nMake tickets\n(Sent with it: board.jpg)')).toBe(true);
    expect(withSentFiles(named, ['/tmp/a/board.jpg'])).toContain(
      '(Sent with it: board.jpg)\n\n---\n\nThey sent these files',
    );
  });

  const prompt = buildAskPrompt({ project, mode: 'ask', question: 'Make tickets', history: [] });

  it('lists the paths of the files sent with the question after it', () => {
    const paths = ['/tmp/pt-ask-1/board.jpg', '/tmp/pt-ask-1/notes.txt'];
    const sent = withSentFiles(prompt, paths);
    expect(sent.startsWith(prompt)).toBe(true);
    expect(sent).toContain('They sent these files with the question. Read them before you answer');
    expect(sent.endsWith('\n- /tmp/pt-ask-1/board.jpg\n- /tmp/pt-ask-1/notes.txt')).toBe(true);
  });

  it('leaves a question without files as it was', () => {
    expect(withSentFiles(prompt, [])).toBe(prompt);
  });
});
