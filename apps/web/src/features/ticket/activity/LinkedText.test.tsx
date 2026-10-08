import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Activity } from '@tracker/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { comment, listItem, makeTicketDetail, STATUS } from '../../../api/test/fixtures';
import { skipAnimations } from '../../../overlays/testing';
import { renderTicket } from '../test/renderTicket';

const CLAUDE = { kind: 'agent', name: 'Claude' } as const;
const PR = 'https://github.com/example/mobile-app/pull/42';
const BUILD = 'https://preview.example.com/build/123';

let cleanups: Array<() => void> = [];

beforeEach(() => {
  localStorage.clear();
  cleanups = [skipAnimations()];
});

afterEach(() => {
  cleanups.forEach((undo) => undo());
});

function setup(activity: Activity[], statusId: string = STATUS.todo, description = '') {
  const item = listItem(1, statusId, 0, { description });
  const rendered = renderTicket({ detail: makeTicketDetail(item, { activity }) });
  cleanups.push(rendered.restorePhone);
  return rendered;
}

const log = () => screen.getByRole('region', { name: 'Activity' });
const hrefs = (container: HTMLElement) =>
  within(container)
    .queryAllByRole('link')
    .map((link) => link.getAttribute('href'));

const report = (id: string, text: string) =>
  comment(id, text, { type: 'report', actor: CLAUDE, createdAt: 2 });

describe('links in activity', () => {
  it('turns URLs in a comment into links that open in a new tab', () => {
    setup([comment('c1', `Opened a PR: ${PR} - preview build at ${BUILD}`, { actor: CLAUDE })]);
    expect(hrefs(log())).toEqual([PR, BUILD]);
    for (const link of within(log()).getAllByRole('link')) {
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    }
    expect(within(log()).getByRole('link', { name: PR })).toHaveTextContent(PR);
    expect(log()).toHaveTextContent(`Opened a PR: ${PR} - preview build at ${BUILD}`);
  });

  it('links URLs in raw reports, report sections and review summaries', () => {
    const sections = [
      'TICKET: MOB-1',
      'STATUS: done',
      'SUMMARY: See https://x.dev/summary.',
      'FILES: https://x.dev/files',
      'NEXT: Try https://x.dev/next',
    ].join('\n');
    const review = comment('v1', 'Checked (https://x.dev/review), works.', {
      type: 'review',
      actor: CLAUDE,
      review: { verdict: 'approved', rating: 5 },
      createdAt: 3,
    });
    setup(
      [report('r1', 'Pushed https://x.dev/raw.'), report('r2', sections), review],
      STATUS.reviewed,
    );
    expect(hrefs(log())).toEqual([
      'https://x.dev/raw',
      'https://x.dev/summary',
      'https://x.dev/next',
      'https://x.dev/files',
      'https://x.dev/review',
    ]);
    const latest = screen.getByRole('region', { name: 'Latest review' });
    expect(hrefs(latest)).toEqual(['https://x.dev/review']);
  });

  it('never turns the text into markup', () => {
    setup([comment('c1', '<b>bold</b> <a href="javascript:alert(1)">x</a> https://x.dev/a')]);
    expect(hrefs(log())).toEqual(['https://x.dev/a']);
    expect(log().querySelector('b')).toBeNull();
    expect(log()).toHaveTextContent('<b>bold</b> <a href="javascript:alert(1)">x</a>');
  });

  it('keeps comment editing and the card menu as they were', async () => {
    const user = userEvent.setup();
    setup([comment('c1', `PR: ${PR}`)]);
    await user.click(screen.getByRole('button', { name: 'Comment options' }));
    await user.click(screen.getByRole('button', { name: 'Edit comment' }));
    expect(screen.getByLabelText('Edit comment')).toHaveValue(`PR: ${PR}`);
    expect(hrefs(log())).toEqual([]);
  });

  it('keeps the description a plain text field', () => {
    setup([], STATUS.todo, `Spec: ${PR}`);
    expect(screen.getByLabelText('Description')).toHaveValue(`Spec: ${PR}`);
    expect(screen.queryByRole('link', { name: PR })).not.toBeInTheDocument();
  });
});
