import { describe, expect, it } from 'vitest';
import { formatActivity } from '../../src/format/activity';
import { formatTicket } from '../../src/format/ticket';
import { activity, at, attachment, detail, projectSummary, statusAt, ticket } from '../fixtures';

const claude = { kind: 'agent', name: 'Claude' } as const;
const reviewer = { kind: 'agent', name: 'Reviewer' } as const;
const landscape = attachment({
  id: 'a2',
  activityId: 'act2',
  fileName: 'landscape.png',
  size: 348_160,
  width: null,
  height: null,
});

describe('formatTicket', () => {
  it('prints the full ticket with attachments and activity oldest first', () => {
    const {
      totalCount: _t,
      openCount: _o,
      doneCount: _d,
      lastActivityAt: _l,
      ...project
    } = projectSummary({ repo: '~/code/mobile' });
    const view = formatTicket(
      detail({
        ticket: ticket({
          description: 'Steps:\n1. Open profile\n2. Rotate',
          assignee: 'Sam',
          due: '2026-10-09',
        }),
        project,
        status: statusAt(1),
        attachments: [attachment(), landscape],
        activity: [
          activity({
            id: 'act5',
            actor: reviewer,
            text: 'changed status to To do',
            createdAt: at(3, 12, 1),
          }),
          activity({ id: 'act1' }),
          activity({
            id: 'act1b',
            actor: claude,
            text: 'changed status to In progress',
            createdAt: at(3, 9),
          }),
          activity({
            id: 'act2',
            type: 'comment',
            text: 'Also happens in landscape.',
            attachments: [landscape],
            createdAt: at(3, 9, 30),
            editedAt: at(3, 9, 40),
          }),
          activity({
            id: 'act3',
            type: 'report',
            actor: claude,
            text: 'SUMMARY: Locked the orientation handler.\nFILES: src/profile.ts',
            createdAt: at(3, 11),
          }),
          activity({
            id: 'act4',
            type: 'review',
            actor: reviewer,
            text: 'Works, but add a test.',
            review: { verdict: 'changes_requested', rating: 3 },
            createdAt: at(3, 12),
          }),
        ],
      }),
    );

    expect(view).toBe(
      [
        '# MOB-3: Crash when rotating the profile screen',
        'Status: In progress (in_progress) · Priority: High · Assignee: Sam · Due: 2026-10-09',
        'Project: Mobile app (MOB) · Repository: ~/code/mobile',
        '',
        '## Description',
        'Steps:',
        '1. Open profile',
        '2. Rotate',
        '',
        '## Attachments',
        '- screenshot.png · 1 KB · 1170×2532',
        '',
        '## Activity (oldest first)',
        '- User created the ticket · 2026-10-02 14:05',
        '- Claude changed status to In progress · 2026-10-03 09:00',
        '',
        '### Comment · User · 2026-10-03 09:30 (edited)',
        'Also happens in landscape.',
        'Attachments:',
        '- landscape.png · 340 KB',
        '',
        '### Report · Claude · 2026-10-03 11:00',
        'SUMMARY: Locked the orientation handler.',
        'FILES: src/profile.ts',
        '',
        '### Review · Reviewer · Changes requested · ★ 3/5 · 2026-10-03 12:00',
        'Works, but add a test.',
        '',
        '- Reviewer changed status to To do · 2026-10-03 12:01',
      ].join('\n'),
    );
  });

  it('fills in empty fields', () => {
    expect(formatTicket(detail({ ticket: ticket({ title: '' }) }))).toBe(
      [
        '# MOB-3: Untitled',
        'Status: To do (todo) · Priority: High · Assignee: Unassigned · Due: None',
        'Project: Mobile app (MOB)',
        '',
        '## Description',
        '(No description.)',
        '',
        '## Activity (oldest first)',
        '(No activity yet.)',
      ].join('\n'),
    );
  });
});

describe('formatTicket with project instructions', () => {
  const withInstructions = (instructions: string | undefined) =>
    formatTicket(detail({ project: { ...detail().project, instructions } }));

  it('shows them after the project line, before the description', () => {
    expect(withInstructions('  Write in a plain voice.\nCite two sources.\n')).toContain(
      [
        'Project: Mobile app (MOB)',
        '',
        '## Project instructions',
        'Write in a plain voice.',
        'Cite two sources.',
        '',
        '## Description',
      ].join('\n'),
    );
  });

  it('leaves them out when empty, blank or from a tracker without them', () => {
    const today = withInstructions(undefined);
    expect(today).not.toContain('Project instructions');
    expect(withInstructions('')).toBe(today);
    expect(withInstructions(' \n ')).toBe(today);
  });
});

describe('formatActivity', () => {
  it('shows an approved review with its stars', () => {
    const review = activity({
      type: 'review',
      actor: reviewer,
      text: 'All good.',
      review: { verdict: 'approved', rating: 5 },
    });
    expect(formatActivity([review])).toBe(
      '### Review · Reviewer · Approved · ★ 5/5 · 2026-10-02 14:05\nAll good.',
    );
  });

  it('shows an attachment-only comment without a blank body', () => {
    const comment = activity({ type: 'comment', text: '  ', attachments: [attachment()] });
    expect(formatActivity([comment])).toBe(
      '### Comment · User · 2026-10-02 14:05\nAttachments:\n- screenshot.png · 1 KB · 1170×2532',
    );
  });

  it('names the file and line of a line comment', () => {
    const line = { runId: 'r1', path: 'src/a.ts', side: 'new' as const, line: 12 };
    const comment = activity({ type: 'comment', text: 'Rename this.', line });
    expect(formatActivity([comment])).toBe(
      '### Comment on src/a.ts line 12 · User · 2026-10-02 14:05\nRename this.',
    );
  });
});
