import { describe, expect, it, vi } from 'vitest';
import { claimNextTicket } from '../../src/tools/claimNextTicket';
import { claimTicket } from '../../src/tools/claimTicket';
import { reviewTicket } from '../../src/tools/reviewTicket';
import { submitForReview } from '../../src/tools/submitForReview';
import { fakeClient, returns } from '../fakeClient';
import { attachment, detail, statusAt, ticket } from '../fixtures';

import { run } from './run';

const inProgress = () =>
  detail({
    ticket: ticket({ statusId: 's2' }),
    status: statusAt(1),
    attachments: [attachment()],
  });

describe('claim_next_ticket', () => {
  it('claims and returns the full ticket with its images', async () => {
    const claimed = inProgress();
    const claimNext = vi.fn(returns(claimed));
    const reply = await run(claimNextTicket, fakeClient({ claimNext }), { project: 'mob' });
    expect(claimNext).toHaveBeenCalledWith('MOB');
    const lines = reply.text.split('\n');
    expect(lines[0]).toBe('Claimed MOB-3. It is now in In progress.');
    expect(lines[2]).toBe('# MOB-3: Crash when rotating the profile screen');
    expect(reply.data).toBe(claimed);
    expect(reply.images).toEqual([attachment()]);
  });

  it('says so when nothing is waiting', async () => {
    const reply = await run(claimNextTicket, fakeClient({ claimNext: returns(null) }), {
      project: 'MOB',
    });
    expect(reply).toEqual({
      text: 'No tickets to claim in MOB: nothing is waiting in a To do status.',
      data: null,
    });
  });
});

describe('claim_ticket', () => {
  it('claims the named ticket', async () => {
    const claimTicketApi = vi.fn(returns(inProgress()));
    const reply = await run(claimTicket, fakeClient({ claimTicket: claimTicketApi }), {
      ticket: 'mob-3',
    });
    expect(claimTicketApi).toHaveBeenCalledWith('MOB-3');
    expect(reply.text.split('\n')[0]).toBe('Claimed MOB-3. It is now in In progress.');
    expect(reply.images).toHaveLength(1);
  });
});

describe('submit_for_review', () => {
  it('asks for verification that fits code and work that is not code', () => {
    expect(submitForReview.description).toContain(
      "the tests and the build when it is code, otherwise against the ticket and the project's instructions",
    );
  });

  it('submits the report and names the new status', async () => {
    const submitted = detail({ ticket: ticket({ statusId: 's3' }), status: statusAt(2) });
    const submitForReviewApi = vi.fn(returns(submitted));
    const reply = await run(submitForReview, fakeClient({ submitForReview: submitForReviewApi }), {
      ticket: 'MOB-3',
      summary: ' Fixed the crash. Tests pass. ',
      files: 'src/profile.ts',
      next: 'none',
    });
    expect(submitForReviewApi).toHaveBeenCalledWith('MOB-3', {
      summary: 'Fixed the crash. Tests pass.',
      files: 'src/profile.ts',
      next: 'none',
    });
    expect(reply.text).toBe('Submitted MOB-3 for review. It is now in Need review.');
    expect(reply.data).toBe(submitted);
  });

  it('passes the attached results as output', async () => {
    const submitForReviewApi = vi.fn(returns(detail()));
    await run(submitForReview, fakeClient({ submitForReview: submitForReviewApi }), {
      ticket: 'MOB-3',
      summary: 'Wrote the draft.',
      output: 'draft.md\nfigures.csv',
    });
    expect(submitForReviewApi).toHaveBeenCalledWith('MOB-3', {
      summary: 'Wrote the draft.',
      output: 'draft.md\nfigures.csv',
    });
  });

  it('requires a summary', () => {
    const result = submitForReview.input.safeParse({ ticket: 'MOB-3', summary: '' });
    expect(result.error?.issues[0]?.message).toBe('Write a summary of the work.');
  });
});

describe('review_ticket', () => {
  it('approves with a rating', async () => {
    const reviewed = detail({ ticket: ticket({ statusId: 's4' }), status: statusAt(3) });
    const reviewTicketApi = vi.fn(returns(reviewed));
    const reply = await run(reviewTicket, fakeClient({ reviewTicket: reviewTicketApi }), {
      ticket: 'MOB-3',
      verdict: 'approved',
      rating: 4,
      summary: 'Works; one nit about naming.',
    });
    expect(reviewTicketApi).toHaveBeenCalledWith('MOB-3', {
      verdict: 'approved',
      rating: 4,
      summary: 'Works; one nit about naming.',
    });
    expect(reply.text).toBe('Reviewed MOB-3: Approved · ★ 4/5. It is now in Reviewed.');
  });

  it('requests changes and names the status it went back to', async () => {
    const reviewTicketApi = vi.fn(returns(detail()));
    const reply = await run(reviewTicket, fakeClient({ reviewTicket: reviewTicketApi }), {
      ticket: 'MOB-3',
      verdict: 'changes_requested',
      rating: 2,
      summary: 'Landscape still crashes.',
    });
    expect(reply.text).toBe('Reviewed MOB-3: Changes requested · ★ 2/5. It is now in To do.');
  });

  it.each([0, 6, 2.5, Number.NaN])('rejects the rating %s', (value) => {
    const result = reviewTicket.input.safeParse({
      ticket: 'MOB-3',
      verdict: 'approved',
      rating: value,
      summary: 'ok',
    });
    expect(result.error?.issues[0]?.message).toBe('Rating must be a whole number from 1 to 5.');
  });

  it('rejects an unknown verdict', () => {
    const result = reviewTicket.input.safeParse({
      ticket: 'MOB-3',
      verdict: 'done',
      rating: 5,
      summary: 'ok',
    });
    expect(result.success).toBe(false);
  });
});
