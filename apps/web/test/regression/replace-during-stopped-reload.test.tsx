import type { SessionState } from '@tracker/shared';
import { act, render, screen } from '@testing-library/react';
import { ApiError } from '@tracker/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeClient } from '../../src/api/test/fakeClient';
import { makeBoard } from '../../src/api/test/fixtures';
import { createTestQueryClient } from '../../src/api/test/render';
import { ProjectScreen, TicketScreen } from '../../src/app/lazyParts';
import { projectSummary } from '../../src/app/test/harness';
import { TrackerApp } from '../../src/app/TrackerApp';
import { forgetReload, reloadPage } from '../../src/lib/pageReload';
import { mockPhone, skipAnimations } from '../../src/overlays/testing';

// Reviewer 133 (PT-153): while a reload was on its way, a replace the app made on its own was held
// like a push, then dropped when the reload never came (the browser's Stop). A ticket that answered
// 404 meanwhile never fell back to its project, so the screen stayed on "Loading MOB-8".
const OPEN_SESSION: SessionState = { authRequired: false, authenticated: true };
const DELETED = new ApiError(404, 'not_found', 'Ticket MOB-8 not found');

const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

let restore: Array<() => void> = [];

beforeEach(() => {
  vi.useFakeTimers();
  restore = [skipAnimations(), mockPhone(true)];
});

afterEach(() => {
  restore.forEach((undo) => undo());
  forgetReload();
  vi.useRealTimers();
  window.history.replaceState(null, '', '/');
});

describe('regression: a replace while a reload is on its way', () => {
  it('goes at once, so a missing ticket still falls back to its project', async () => {
    let gone = () => undefined as void;
    const ticket = new Promise<never>((_resolve, reject) => (gone = () => reject(DELETED)));
    await Promise.all([ProjectScreen.preload(), TicketScreen.preload()]);
    window.history.replaceState(null, '', '/p/MOB/8');
    const entries = window.history.length;
    const client = fakeClient({
      getSession: () => Promise.resolve(OPEN_SESSION),
      listProjects: () => Promise.resolve([projectSummary()]),
      listAllTickets: () => Promise.resolve({ tickets: [], statuses: [] }),
      getBoard: () => Promise.resolve(makeBoard()),
      getTicket: () => ticket,
    });
    render(<TrackerApp client={client} queryClient={createTestQueryClient()} />);
    await advance(500);
    expect(screen.getAllByRole('main').length).toBeGreaterThan(0);

    act(() => reloadPage(() => undefined));
    await act(async () => {
      gone();
      await ticket.catch(() => undefined);
    });
    await advance(100);
    expect(window.location.pathname).toBe('/p/MOB');
    expect(window.history.length).toBe(entries);
  });
});
