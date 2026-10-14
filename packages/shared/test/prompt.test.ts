import { describe, expect, it } from 'vitest';
import {
  ASK_PERSON_LINE,
  buildBatchPrompt,
  buildProjectPrompt,
  buildTicketPrompt,
  ticketBlock,
  type PromptProject,
  type PromptTicket,
} from '../src/logic/prompt';

const NOW = new Date(2026, 9, 7, 12, 0);
const FENCE = '```';

const lines = (...parts: string[]) => parts.join('\n');

const project: PromptProject = { name: 'Mobile app', key: 'MOB', repo: '~/code/mobile-app' };
const noRepo: PromptProject = { ...project, repo: '' };

const plain: PromptTicket = {
  key: 'MOB-4',
  title: 'Dark mode colors for Settings',
  description: '',
  priority: 'medium',
  statusName: 'To do',
  due: '',
  assignee: '',
  notes: [],
  lastReport: null,
  lastReview: null,
};

const crash: PromptTicket = {
  key: 'MOB-3',
  title: 'Crash when rotating the profile screen',
  description: 'Steps: open Profile, rotate the device twice.',
  priority: 'high',
  statusName: 'To do',
  due: '2026-10-09',
  assignee: 'Dara',
  notes: ['First note,\nwith line breaks\n\n   collapsed to spaces'],
  lastReport: lines('TICKET: MOB-3', 'STATUS: in progress', '…'),
  lastReview: null,
};

const login: PromptTicket = {
  key: 'MOB-2',
  title: 'Show an error when the password is wrong',
  description: 'Inline error under the password field. Keep the email filled in.',
  priority: 'high',
  statusName: 'In progress',
  due: '2026-10-09',
  assignee: 'Sophea',
  notes: ['Design is approved. Starting on this today.'],
  lastReport: null,
  lastReview: null,
};

const blockLines = (ticket: Partial<PromptTicket>) =>
  ticketBlock({ ...plain, ...ticket }, '##', NOW).split('\n');

describe('ticketBlock', () => {
  it('starts with the heading, key and title, then the meta line and description', () => {
    expect(ticketBlock(plain, '###', NOW)).toBe(
      lines(
        '### MOB-4: Dark mode colors for Settings',
        'Priority: Medium · Status: To do',
        '',
        '(No description.)',
      ),
    );
  });

  it('writes Untitled for an empty title', () => {
    expect(blockLines({ title: '' })[0]).toBe('## MOB-4: Untitled');
  });

  it('writes (No description.) for an empty or blank description', () => {
    expect(blockLines({ description: '' })[3]).toBe('(No description.)');
    expect(blockLines({ description: '  \n\t ' })[3]).toBe('(No description.)');
  });

  it('trims the description and keeps its inner line breaks', () => {
    expect(blockLines({ description: '\n  Step one.\nStep two.  \n' }).slice(3)).toEqual([
      'Step one.',
      'Step two.',
    ]);
  });

  it('labels the priority High, Medium or Low', () => {
    expect(blockLines({ priority: 'high' })[1]).toBe('Priority: High · Status: To do');
    expect(blockLines({ priority: 'medium' })[1]).toBe('Priority: Medium · Status: To do');
    expect(blockLines({ priority: 'low' })[1]).toBe('Priority: Low · Status: To do');
  });

  it('shows the status name it is given', () => {
    expect(blockLines({ statusName: 'Need review' })[1]).toBe(
      'Priority: Medium · Status: Need review',
    );
  });

  it('shows Due and Assignee only when they are set', () => {
    expect(blockLines({ due: '2026-10-09' })[1]).toBe(
      'Priority: Medium · Status: To do · Due: Oct 9',
    );
    expect(blockLines({ assignee: 'Dara' })[1]).toBe(
      'Priority: Medium · Status: To do · Assignee: Dara',
    );
    expect(blockLines({ due: '2026-10-09', assignee: 'Dara' })[1]).toBe(
      'Priority: Medium · Status: To do · Due: Oct 9 · Assignee: Dara',
    );
  });

  it('adds the year to a due date outside the current year', () => {
    expect(blockLines({ due: '2027-01-05' })[1]).toBe(
      'Priority: Medium · Status: To do · Due: Jan 5, 2027',
    );
    expect(blockLines({ due: '2025-12-31' })[1]).toBe(
      'Priority: Medium · Status: To do · Due: Dec 31, 2025',
    );
  });

  it('lists every note on one line, with line breaks collapsed to spaces', () => {
    const notes = ['One\r\ntwo', 'Three\n\n  four  \n five', 'Six'];

    expect(blockLines({ notes }).slice(4)).toEqual([
      '',
      'Notes:',
      '- One two',
      '- Three four five',
      '- Six',
    ]);
  });

  it('leaves out the Notes section without notes', () => {
    expect(ticketBlock(plain, '##', NOW)).not.toContain('Notes:');
  });

  it('adds the last report after the notes', () => {
    const report = lines('TICKET: MOB-4', 'STATUS: blocked');

    expect(blockLines({ notes: ['A note'], lastReport: report }).slice(4)).toEqual([
      '',
      'Notes:',
      '- A note',
      '',
      'Your last report on this ticket:',
      'TICKET: MOB-4',
      'STATUS: blocked',
    ]);
  });

  it('adds the last review with its verdict and rating after the last report', () => {
    const lastReview = {
      verdict: 'changes_requested' as const,
      rating: 2,
      text: 'The error shows under the wrong field.',
    };

    expect(blockLines({ lastReport: 'TICKET: MOB-4', lastReview }).slice(4)).toEqual([
      '',
      'Your last report on this ticket:',
      'TICKET: MOB-4',
      '',
      'Last review: Changes requested · 2/5',
      'The error shows under the wrong field.',
    ]);
  });

  it('labels an approved review', () => {
    const lastReview = { verdict: 'approved' as const, rating: 5, text: 'Looks good.' };

    expect(blockLines({ lastReview }).slice(4)).toEqual([
      '',
      'Last review: Approved · 5/5',
      'Looks good.',
    ]);
  });
});

describe('buildTicketPrompt', () => {
  it('builds the SPEC example prompt', () => {
    expect(buildTicketPrompt(project, crash, NOW)).toBe(
      lines(
        'Please work on ticket MOB-3 from my "Mobile app" project.',
        'Repository / folder: ~/code/mobile-app',
        '',
        '## MOB-3: Crash when rotating the profile screen',
        'Priority: High · Status: To do · Due: Oct 9 · Assignee: Dara',
        '',
        'Steps: open Profile, rotate the device twice.',
        '',
        'Notes:',
        '- First note, with line breaks collapsed to spaces',
        '',
        'Your last report on this ticket:',
        'TICKET: MOB-3',
        'STATUS: in progress',
        '…',
        '',
        ASK_PERSON_LINE,
        '',
        '## When you finish',
        'End your reply with this block, filled in, so I can paste it back into my tracker:',
        '',
        FENCE,
        'TICKET: MOB-3',
        'STATUS: done | in progress | blocked',
        'SUMMARY: what you changed, in 1-3 sentences',
        'FILES: files you created or edited',
        'OUTPUT: results that aren\'t code (a draft, a CSV, an image), attached with attach_file, or "none"',
        'NEXT: anything I still need to do, or "none"',
        FENCE,
      ),
    );
  });

  it('leaves out the repository line when the project has none', () => {
    expect(buildTicketPrompt(noRepo, plain, NOW)).toBe(
      lines(
        'Please work on ticket MOB-4 from my "Mobile app" project.',
        '',
        '## MOB-4: Dark mode colors for Settings',
        'Priority: Medium · Status: To do',
        '',
        '(No description.)',
        '',
        ASK_PERSON_LINE,
        '',
        '## When you finish',
        'End your reply with this block, filled in, so I can paste it back into my tracker:',
        '',
        FENCE,
        'TICKET: MOB-4',
        'STATUS: done | in progress | blocked',
        'SUMMARY: what you changed, in 1-3 sentences',
        'FILES: files you created or edited',
        'OUTPUT: results that aren\'t code (a draft, a CSV, an image), attached with attach_file, or "none"',
        'NEXT: anything I still need to do, or "none"',
        FENCE,
      ),
    );
  });

  it('includes the last review in the ticket block', () => {
    const reviewed: PromptTicket = {
      ...plain,
      lastReview: { verdict: 'changes_requested', rating: 2, text: 'Colors are too dark.' },
    };

    expect(buildTicketPrompt(project, reviewed, NOW)).toContain(
      lines(
        '(No description.)',
        '',
        'Last review: Changes requested · 2/5',
        'Colors are too dark.',
        '',
        ASK_PERSON_LINE,
        '',
        '## When you finish',
      ),
    );
  });

  it('compares the due year with the current year by default', () => {
    const due = `${new Date().getFullYear()}-06-15`;

    expect(buildTicketPrompt(project, { ...plain, due })).toContain('Due: Jun 15\n');
  });
});

describe('buildProjectPrompt', () => {
  const crashToday: PromptTicket = { ...crash, due: '2026-10-08', notes: [], lastReport: null };

  it('builds the SPEC example prompt', () => {
    expect(buildProjectPrompt(project, [login, crashToday], NOW)).toBe(
      lines(
        'Here are the open tickets for my "Mobile app" project. Work through them in order, highest priority first, and check with me before large or risky changes.',
        'Repository / folder: ~/code/mobile-app',
        '',
        '---',
        '',
        '### MOB-2: Show an error when the password is wrong',
        'Priority: High · Status: In progress · Due: Oct 9 · Assignee: Sophea',
        '',
        'Inline error under the password field. Keep the email filled in.',
        '',
        'Notes:',
        '- Design is approved. Starting on this today.',
        '',
        '---',
        '',
        '### MOB-3: Crash when rotating the profile screen',
        'Priority: High · Status: To do · Due: Oct 8 · Assignee: Dara',
        '',
        'Steps: open Profile, rotate the device twice.',
        '',
        '---',
        '',
        '## When you finish',
        'For each ticket you worked on, end your reply with one block like this, filled in, so I can paste it back into my tracker:',
        '',
        FENCE,
        'TICKET: MOB-<number>',
        'STATUS: done | in progress | blocked',
        'SUMMARY: what you changed, in 1-3 sentences',
        'FILES: files you created or edited',
        'OUTPUT: results that aren\'t code (a draft, a CSV, an image), attached with attach_file, or "none"',
        'NEXT: anything I still need to do, or "none"',
        FENCE,
      ),
    );
  });

  it('leaves out the repository line when the project has none', () => {
    const prompt = buildProjectPrompt(noRepo, [plain], NOW).split('\n');

    expect(prompt.slice(0, 4)).toEqual([
      'Here are the open tickets for my "Mobile app" project. Work through them in order, highest priority first, and check with me before large or risky changes.',
      '',
      '---',
      '',
    ]);
    expect(prompt.join('\n')).not.toContain('Repository / folder');
  });

  it('keeps the ticket order it is given', () => {
    const prompt = buildProjectPrompt(project, [plain, login], NOW);

    expect(prompt.indexOf('### MOB-4')).toBeLessThan(prompt.indexOf('### MOB-2'));
  });

  it('shows the last review in each ticket block', () => {
    const reviewed: PromptTicket = {
      ...plain,
      lastReview: { verdict: 'approved', rating: 4, text: 'Fine.' },
    };

    expect(buildProjectPrompt(project, [reviewed], NOW)).toContain(
      lines('Last review: Approved · 4/5', 'Fine.', '', '---'),
    );
  });
});

describe('buildBatchPrompt', () => {
  const tickets = [crash, plain];

  it('lists the tickets and caps the sub agents at the limit', () => {
    const text = buildBatchPrompt(project, tickets, 5);
    expect(text).toContain('Please work on these 2 tickets from my "Mobile app" project');
    expect(text).toContain('Repository / folder: ~/code/mobile-app');
    expect(text).toContain('- MOB-3 · High · Crash when rotating the profile screen');
    expect(text).toContain('- MOB-4 · Medium · Dark mode colors for Settings');
    expect(text).toContain('Run at most 5 sub agents at once.');
    expect(text).toContain('As soon as a sub agent ends, give the next ticket to a new one');
  });

  it('puts the limit it is given in the prompt', () => {
    expect(buildBatchPrompt(project, tickets, 2)).toContain('Run at most 2 sub agents at once.');
  });

  it('has each sub agent claim, report and never finish its ticket', () => {
    const text = buildBatchPrompt(project, tickets, 5);
    expect(text).toContain('claim_ticket');
    expect(text).toContain('submit_for_review');
    expect(text).toContain('Never move a ticket to Done.');
    expect(text).toContain('When a ticket fails, go on with the others.');
  });

  it('leaves out ticket descriptions, which each sub agent reads itself', () => {
    expect(buildBatchPrompt(project, tickets, 5)).not.toContain(crash.description);
  });

  it('ends with the report block for each ticket', () => {
    expect(buildBatchPrompt(noRepo, tickets, 5)).toMatch(/TICKET: MOB-<number>\n/);
    expect(buildBatchPrompt(noRepo, tickets, 5)).not.toContain('Repository / folder');
  });
});
