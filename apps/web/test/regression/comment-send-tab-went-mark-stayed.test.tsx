import { act, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { makeTicketDetail } from '../../src/api/test/fixtures';
import { LEFT_SAVE_WAIT_MS } from '../../src/features/ticket/drafts/useTicketDrafts';
import { fakeLocks } from '../../src/features/ticket/test/fakeLocks';
import { renderTicket } from '../../src/features/ticket/test/renderTicket';
import { storedDrafts } from '../../src/lib/storedDrafts';
import { skipAnimations } from '../../src/overlays/testing';

let cleanups: Array<() => void> = [];

beforeEach(() => {
  localStorage.clear();
  cleanups = [skipAnimations()];
});

afterEach(() => {
  cleanups.forEach((undo) => undo());
});

async function tabASends(text: string): Promise<void> {
  vi.resetModules();
  const tabA = await import('../../src/features/ticket/activity/sentComments');
  tabA.startSend('MOB-1', text, 0);
}

const sendsKept = () => storedDrafts().filter(([, draft]) => draft.field === 'comment-send');

// Reviewer 96 (PT-105, PT-135): in WebKit under load, B's box was still empty 5 s after A closed
// mid-send, and B read nothing. A page closing that way can lose its last writes to storage, here
// its removal of its mark of the send, which B then waited a minute to run out.
it('brings back a comment whose tab went, though that tab’s mark of it stayed', async () => {
  const locks = fakeLocks();
  cleanups.push(locks.restore);
  await tabASends('Looks good');
  const getTicket = vi.fn().mockResolvedValue(makeTicketDetail());
  const rendered = renderTicket({ client: { getTicket } });
  cleanups.push(rendered.restorePhone);
  const box = screen.getByLabelText('Comment');
  // While A is open, its comment is its own to settle.
  await act(() => new Promise((resolve) => setTimeout(resolve, LEFT_SAVE_WAIT_MS + 200)));
  expect(box).toHaveValue('');
  expect(sendsKept()).toHaveLength(1);

  act(() => locks.pagesGo());
  await waitFor(() => expect(box).toHaveValue('Looks good'));
  expect(sendsKept()).toEqual([]);
});
