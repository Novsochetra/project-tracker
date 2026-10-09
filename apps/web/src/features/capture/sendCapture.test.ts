import { ApiError } from '@tracker/client';
import type { Ticket } from '@tracker/shared';
import { describe, expect, it, vi } from 'vitest';
import { listItem, STATUS } from '../../api/test/fixtures';
import { textNotSaved } from './captureForm';
import { laterText, sendCapture, TextNotSavedError } from './sendCapture';

const FIRST = { title: 'First idea', description: '', priority: 'high' } as const;
const capture = { title: 'Idea', description: 'Steps', priority: 'high', sent: FIRST } as const;

const ticketWith = (overrides: Partial<Ticket>): Ticket => {
  const {
    commentCount: _c,
    attachmentCount: _a,
    lastReview: _r,
    ...ticket
  } = listItem(7, STATUS.todo, 0, overrides);
  return ticket;
};

const sameText = ticketWith({ title: 'Idea', description: 'Steps', priority: 'high' });
const earlierText = ticketWith(FIRST);
const otherEdit = { title: 'Idea, edited', description: 'Their steps', priority: 'low' } as const;

describe('laterText', () => {
  it('is nothing when the ticket has the capture text', () => {
    expect(laterText(sameText, capture)).toBeNull();
  });

  it('is each field the person changed since the first create', () => {
    expect(laterText(earlierText, capture)).toEqual({ title: 'Idea', description: 'Steps' });
    expect(laterText(earlierText, { ...FIRST, priority: 'low', sent: FIRST })).toEqual({
      priority: 'low',
    });
  });

  it('leaves the fields the person did not change, whatever the ticket says now', () => {
    expect(laterText(ticketWith(otherEdit), { ...FIRST, sent: FIRST })).toBeNull();
    expect(laterText(ticketWith(otherEdit), { ...FIRST, title: 'Idea', sent: FIRST })).toEqual({
      title: 'Idea',
    });
  });

  it('takes a capture without sent text as unchanged since the first create', () => {
    expect(
      laterText(ticketWith(otherEdit), { title: 'Idea', description: '', priority: 'high' }),
    ).toBeNull();
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

  it('still names the files the create left out once the later text is saved', async () => {
    const saved = ticketWith(capture);
    const update = vi.fn().mockResolvedValue(saved);
    const created = { ...earlierText, leftOutAttachmentIds: ['a-2'] };
    await expect(
      sendCapture(capture, { create: () => Promise.resolve(created), update }),
    ).resolves.toEqual({ ...saved, leftOutAttachmentIds: ['a-2'] });
  });

  it('says plainly that the ticket has the earlier text when the tracker refuses the edit', async () => {
    const update = vi.fn().mockRejectedValue(new ApiError(404, 'not_found', 'Ticket not found.'));
    const sent = sendCapture(capture, { create: () => Promise.resolve(earlierText), update });
    await expect(sent).rejects.toEqual(expect.any(TextNotSavedError));
    await expect(sent).rejects.toEqual(expect.any(ApiError));
    await expect(sent).rejects.toMatchObject({
      status: 404,
      message: textNotSaved('MOB-7'),
      ticketKey: 'MOB-7',
    });
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
