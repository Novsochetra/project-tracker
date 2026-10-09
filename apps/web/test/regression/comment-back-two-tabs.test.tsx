import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { deferred } from '../../src/api/test/deferred';
import { renderTicket } from '../../src/features/ticket/test/renderTicket';
import { DRAFTS_STORAGE_KEY } from '../../src/lib/storedDrafts';
import { skipAnimations } from '../../src/overlays/testing';

let cleanups: Array<() => void> = [];

beforeEach(() => {
  localStorage.clear();
  cleanups = [skipAnimations()];
});

afterEach(() => {
  cleanups.forEach((undo) => undo());
});

// This tab sends 'Looks good', and the send fails once `fail` is called.
async function sendThatFails() {
  const user = userEvent.setup();
  const sending = deferred<never>();
  const rendered = renderTicket({
    client: { addComment: vi.fn().mockReturnValue(sending.promise) },
  });
  cleanups.push(rendered.restorePhone);
  const box = screen.getByLabelText('Comment');
  await user.type(box, 'Looks good');
  await user.click(screen.getByRole('button', { name: 'Comment' }));
  const fail = () =>
    act(async () => {
      sending.reject(new TypeError('Failed to fetch'));
      await sending.promise.catch(() => undefined);
    });
  return { box, fail };
}

// Tab B: the same modules with memory of their own.
async function otherTab() {
  vi.resetModules();
  return {
    comments: await import('../../src/features/ticket/activity/sentComments'),
    records: await import('../../src/lib/tabRecords'),
  };
}

const heard = () =>
  act(() => {
    window.dispatchEvent(new StorageEvent('storage', { key: DRAFTS_STORAGE_KEY }));
  });

// PT-111 (from PT-105): a failed comment came back by rewriting the box's kept text. Tab B,
// typing before it had heard of that, wrote its own text over it, and the failed comment was gone.
it('keeps a failed comment in the box when another tab types without having shown it', async () => {
  const { box, fail } = await sendThatFails();
  await fail();
  await waitFor(() => expect(box).toHaveValue('Looks good'));

  const tabB = await otherTab();
  tabB.comments.keepComment('MOB-1', 'From tab B');
  heard();
  await waitFor(() => expect(box).toHaveValue('Looks good\nFrom tab B'));
});

// The other way round: the failed comment came back over the box's text as this tab knew it, and
// typing tab B had done a moment before, which hadn't reached this tab yet, was lost.
it('keeps typing another tab did just before a failed comment came back', async () => {
  const { box, fail } = await sendThatFails();
  const tabB = await otherTab();
  tabB.comments.keepComment('MOB-1', 'From tab B');
  heard();
  await waitFor(() => expect(box).toHaveValue('From tab B'));
  const earlier = Object.keys(localStorage).find((key) =>
    localStorage.getItem(key)?.includes('"text":"From tab B"'),
  );
  const typedAt = Date.now();

  await fail();
  // Tab B's next keystroke, typed before the failure, reaches this tab only now.
  const record = {
    ticketKey: 'MOB-1',
    field: 'comment',
    base: '',
    text: 'From tab B, more',
  } as const;
  tabB.records.putRecord({ ...record, at: typedAt });
  if (earlier) tabB.records.dropRecord(earlier);
  heard();
  await waitFor(() => expect(box).toHaveValue('Looks good\nFrom tab B, more'));
});
