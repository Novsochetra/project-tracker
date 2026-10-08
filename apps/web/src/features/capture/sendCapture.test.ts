import { ApiError } from '@tracker/client';
import type { Ticket } from '@tracker/shared';
import { describe, expect, it, vi } from 'vitest';
import { listItem, STATUS } from '../../api/test/fixtures';
import { textNotSaved } from './captureForm';
import { laterText, sendCapture } from './sendCapture';

const capture = { title: 'Idea', description: 'Steps', priority: 'high' } as const;

const ticketWith = (overrides: Partial<Ticket>): Ticket => {
  const {
    commentCount: _c,
    attachmentCount: _a,
    lastReview: _r,
    ...ticket
  } = listItem(7, STATUS.todo, 0, overrides);
  return ticket;
};

const sameText = ticketWith(capture);
const earlierText = ticketWith({ title: 'First idea', description: '', priority: 'high' });

describe('laterText', () => {
  it('is nothing when the ticket has the capture text', () => {
    expect(laterText(sameText, capture)).toBeNull();
  });

  it('is each field the capture changed since the ticket was made', () => {
    expect(laterText(earlierText, capture)).toEqual({ title: 'Idea', description: 'Steps' });
    expect(laterText(ticketWith({ ...capture, priority: 'low' }), capture)).toEqual({
      priority: 'high',
    });
  });
});

describe('sendCapture', () => {
  it('gives the created ticket and edits nothing when the text matches', async () => {
    const update = vi.fn();
    await expect(
      sendCapture(capture, { create: () => Promise.resolve(sameText), update }),
    ).resolves.toBe(sameText);
    expect(update).not.toHaveBeenCalled();
  });

  it('saves the later text to the ticket an earlier create made', async () => {
    const saved = ticketWith(capture);
    const update = vi.fn().mockResolvedValue(saved);
    await expect(
      sendCapture(capture, { create: () => Promise.resolve(earlierText), update }),
    ).resolves.toBe(saved);
    expect(update).toHaveBeenCalledWith('MOB-7', { title: 'Idea', description: 'Steps' });
  });

  it('says plainly that the ticket has the earlier text when the tracker refuses the edit', async () => {
    const update = vi.fn().mockRejectedValue(new ApiError(404, 'not_found', 'Ticket not found.'));
    const sent = sendCapture(capture, { create: () => Promise.resolve(earlierText), update });
    await expect(sent).rejects.toEqual(expect.any(ApiError));
    await expect(sent).rejects.toMatchObject({ status: 404, message: textNotSaved('MOB-7') });
  });

  it('passes a network failure on as it is, so a text-only capture can wait offline', async () => {
    const offline = new TypeError('Failed to fetch');
    const update = vi.fn().mockRejectedValue(offline);
    await expect(
      sendCapture(capture, { create: () => Promise.resolve(earlierText), update }),
    ).rejects.toBe(offline);
  });

  it('passes a failed create on without editing', async () => {
    const offline = new TypeError('Failed to fetch');
    const update = vi.fn();
    await expect(
      sendCapture(capture, { create: () => Promise.reject(offline), update }),
    ).rejects.toBe(offline);
    expect(update).not.toHaveBeenCalled();
  });
});
