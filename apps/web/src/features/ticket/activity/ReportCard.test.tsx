import { screen, within } from '@testing-library/react';
import { HUMAN, type Activity } from '@tracker/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { comment, makeTicketDetail, statuses } from '../../../api/test/fixtures';
import { skipAnimations } from '../../../overlays/testing';
import { renderTicket } from '../test/renderTicket';

const CLAUDE = { kind: 'agent', name: 'Claude' } as const;
const lines = (...parts: string[]) => parts.join('\n');

const report = (text: string, actor = CLAUDE as Activity['actor']): Activity =>
  comment('r1', text, { type: 'report', actor, createdAt: Date.now() - 60_000 });

const SUBMISSION = lines(
  'TICKET: MOB-1',
  'STATUS: done',
  'SUMMARY: Fixed the rotation crash; added a rotation test.',
  'FILES: src/profile/Header.tsx, src/profile/Header.test.tsx',
  'NEXT: Check on a real device in landscape',
);

let cleanups: Array<() => void> = [];

beforeEach(() => {
  localStorage.clear();
  cleanups = [skipAnimations()];
});

afterEach(() => {
  cleanups.forEach((undo) => undo());
});

function renderReport(activity: Activity) {
  const rendered = renderTicket({ detail: makeTicketDetail(undefined, { activity: [activity] }) });
  cleanups.push(rendered.restorePhone);
  const log = screen.getByRole('region', { name: 'Activity' });
  return within(log).getByRole('button', { name: 'Report options' }).closest('article')!;
}

const terms = (card: HTMLElement) =>
  within(card)
    .queryAllByRole('term')
    .map((term) => term.textContent);

const section = (card: HTMLElement, label: string) =>
  within(card).getByText(label, { selector: 'dt' }).nextElementSibling as HTMLElement;

describe('report card sections', () => {
  it('shows a submission as Summary, Next and Files under a Submitted for review line', () => {
    const card = renderReport(report(SUBMISSION));
    expect(card).toHaveTextContent('Claude report');
    expect(card).toHaveTextContent('Submitted for review');
    expect(card).not.toHaveTextContent(/TICKET|STATUS|done/);
    expect(terms(card)).toEqual(['Summary', 'Next', 'Files']);
    expect(section(card, 'Summary')).toHaveTextContent(
      'Fixed the rotation crash; added a rotation test.',
    );
    expect(section(card, 'Next')).toHaveTextContent('Check on a real device in landscape');
    expect(
      within(section(card, 'Files'))
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['src/profile/Header.tsx', 'src/profile/Header.test.tsx']);
    const inReview = statuses.find((status) => status.category === 'in_review');
    expect(card.querySelector('[data-category="in_review"]')).toHaveStyle({
      color: inReview?.color,
    });
  });

  it('shows OUTPUT as Output, a list like Files, after Next', () => {
    const text = lines(
      'TICKET: MOB-1',
      'STATUS: done',
      'SUMMARY: Wrote the launch plan.',
      'FILES: docs/plan.md',
      'OUTPUT: plan.md, budget.csv, chart.png',
      'NEXT: Pick a date',
    );
    const card = renderReport(report(text));
    expect(card).not.toHaveTextContent('OUTPUT');
    expect(terms(card)).toEqual(['Summary', 'Next', 'Output', 'Files']);
    expect(
      within(section(card, 'Output'))
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['plan.md', 'budget.csv', 'chart.png']);
  });

  it('leaves out Files and Next when the report says none', () => {
    const card = renderReport(
      report(
        lines(
          'TICKET: MOB-1',
          'STATUS: done',
          'SUMMARY: Dark colors.',
          'FILES: none',
          'NEXT: none',
        ),
      ),
    );
    expect(terms(card)).toEqual(['Summary']);
    expect(card).not.toHaveTextContent('none');
  });

  it('shows a pasted Claude Code report the same way', () => {
    const pasted = lines(
      'TICKET: MOB-1',
      '**STATUS:** done',
      '**SUMMARY:** Added the inline error.',
      '**FILES:**',
      '- `src/login/LoginForm.tsx`',
      '**NEXT:** none',
    );
    const card = renderReport(report(pasted, HUMAN));
    expect(card).toHaveTextContent('Claude Code report');
    expect(card).toHaveTextContent('Submitted for review');
    expect(terms(card)).toEqual(['Summary', 'Files']);
    expect(section(card, 'Files')).toHaveTextContent('src/login/LoginForm.tsx');
  });

  it('shows the status words of a report that isn’t finished', () => {
    const card = renderReport(
      report(lines('STATUS: in progress, blocked on API keys', 'SUMMARY: Half of the screens.')),
    );
    expect(card).toHaveTextContent('Status: in progress, blocked on API keys');
    expect(card).not.toHaveTextContent('Submitted for review');
  });

  it('keeps the raw text of a report it can’t read', () => {
    const card = renderReport(report(lines('TICKET: MOB-1', 'STATUS: done')));
    expect(terms(card)).toEqual([]);
    expect(card).toHaveTextContent('TICKET: MOB-1 STATUS: done');
    expect(card).not.toHaveTextContent('Submitted for review');
  });
});
