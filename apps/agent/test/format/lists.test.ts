import { describe, expect, it } from 'vitest';
import { formatProjects } from '../../src/format/projects';
import { formatStatuses } from '../../src/format/statuses';
import { formatTicketLine, formatTicketList } from '../../src/format/tickets';
import { projectSummary, statuses, ticket } from '../fixtures';

describe('formatProjects', () => {
  it('prints one line per project with key, name, counts and repo', () => {
    const projects = [
      projectSummary(),
      projectSummary({
        key: 'WEB',
        name: 'Website',
        openCount: 0,
        totalCount: 2,
        repo: '~/code/web',
      }),
    ];
    expect(formatProjects(projects)).toBe(
      'MOB · Mobile app · 3 open, 7 total\nWEB · Website · 0 open, 2 total · repo ~/code/web',
    );
  });

  it('says when there are no projects', () => {
    expect(formatProjects([])).toBe('No projects yet.');
  });
});

describe('formatStatuses', () => {
  it('prints name and category in board order', () => {
    const shuffled = statuses().reverse();
    expect(formatStatuses(shuffled)).toBe(
      [
        'To do · todo',
        'In progress · in_progress',
        'Need review · in_review',
        'Reviewed · reviewed',
        'Done · done',
      ].join('\n'),
    );
  });

  it('says when there are no statuses', () => {
    expect(formatStatuses([])).toBe('No statuses.');
  });
});

describe('formatTicketLine', () => {
  it('prints key, status, priority and title', () => {
    expect(formatTicketLine(ticket(), 'To do')).toBe(
      'MOB-3 · To do · High · Crash when rotating the profile screen',
    );
  });

  it('adds the assignee and due date when set', () => {
    const line = formatTicketLine(
      ticket({ priority: 'low', title: 'Dark mode', assignee: 'Sam', due: '2026-10-09' }),
      'In progress',
    );
    expect(line).toBe('MOB-3 · In progress · Low · Dark mode · @Sam · due 2026-10-09');
  });

  it('names untitled tickets', () => {
    expect(formatTicketLine(ticket({ title: '' }), 'To do')).toBe(
      'MOB-3 · To do · High · Untitled',
    );
  });
});

describe('formatTicketList', () => {
  it('resolves status names from the status ids', () => {
    const tickets = [
      ticket(),
      ticket({ key: 'MOB-4', statusId: 's3', priority: 'medium', title: 'Login error' }),
    ];
    expect(formatTicketList(tickets, statuses())).toBe(
      [
        'MOB-3 · To do · High · Crash when rotating the profile screen',
        'MOB-4 · Need review · Medium · Login error',
      ].join('\n'),
    );
  });

  it('marks a status it cannot find', () => {
    expect(formatTicketList([ticket({ statusId: 'gone' })], statuses())).toBe(
      'MOB-3 · Unknown status · High · Crash when rotating the profile screen',
    );
  });

  it('says when nothing matches', () => {
    expect(formatTicketList([], statuses())).toBe('No tickets found.');
  });
});
