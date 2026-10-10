import type { SessionState } from '@tracker/shared';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { fakeClient } from '../../src/api/test/fakeClient';
import { makeBoard, otherProject } from '../../src/api/test/fixtures';
import { createTestQueryClient } from '../../src/api/test/render';
import { projectSummary } from '../../src/app/test/harness';
import { TrackerApp } from '../../src/app/TrackerApp';
import { RELOAD_ON_ITS_WAY_MS } from '../../src/lib/pageReload';
import { mockPhone, skipAnimations, tap } from '../../src/overlays/testing';
import { reloadOnPreloadError } from '../../src/pwa/reloadOnPreloadError';

// PT-119: once a screen's chunk failed and the page asked for a reload, the push that waited for
// it was dropped (PT-108) and its row let go. On a slow network the new page takes a while, and a
// tap on a row meanwhile pushed: its screen showed its error, then the reload loaded Projects into
// that new entry, so the history held Projects twice and the browser's Back stayed on it.

// The Project screen's chunk fails like Vite's preload helper reports it: the event first, then
// the failed import.
const chunk = vi.hoisted(() => {
  let fail = () => undefined as void;
  const loaded = new Promise<void>((_resolve, reject) => {
    fail = () => {
      window.dispatchEvent(
        Object.assign(new Event('vite:preloadError', { cancelable: true }), {
          payload: new TypeError('Failed to fetch dynamically imported module'),
        }),
      );
      reject(new TypeError('Failed to fetch dynamically imported module'));
    };
  });
  return { loaded, fail: () => fail() };
});

vi.mock('../../src/features/project/ProjectScreen', async (importOriginal) => {
  await chunk.loaded;
  return importOriginal();
});

const OPEN_SESSION: SessionState = { authRequired: false, authenticated: true };
const WEBSITE = projectSummary({ id: otherProject.id, key: 'WEB', name: 'Website' });

function renderApp() {
  window.history.replaceState(null, '', '/');
  const client = fakeClient({
    getSession: () => Promise.resolve(OPEN_SESSION),
    listProjects: () => Promise.resolve([projectSummary(), WEBSITE]),
    listAllTickets: () => Promise.resolve({ tickets: [], statuses: [] }),
    getBoard: () => Promise.resolve(makeBoard()),
  });
  render(<TrackerApp client={client} queryClient={createTestQueryClient()} />);
}

const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

let restore: Array<() => void> = [];
let consoleError: MockInstance<typeof console.error>;

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  restore = [skipAnimations(), mockPhone(true)];
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  restore.forEach((undo) => undo());
  consoleError.mockRestore();
  vi.useRealTimers();
  window.sessionStorage.clear();
  window.history.replaceState(null, '', '/');
});

describe('regression: a tap while the page reloads', () => {
  it('adds no history entry, and its row stays pressed until the reload’s time is up', async () => {
    const reload = vi.fn();
    restore.push(reloadOnPreloadError(reload));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderApp();
    const main = await screen.findByRole('main');
    const mobile = await within(main).findByRole('button', { name: /^Mobile app/ });
    const website = within(main).getByRole('button', { name: /^Website/ });
    const entries = window.history.length;
    await tap(user, mobile);
    await act(async () => {
      chunk.fail();
      await chunk.loaded.catch(() => undefined);
    });
    expect(reload).toHaveBeenCalledTimes(1);

    await advance(300);
    await tap(user, mobile);
    await advance(100);
    expect(window.location.pathname).toBe('/');
    expect(window.history.length).toBe(entries);
    expect(mobile).toHaveAttribute('data-opening');

    await tap(user, website);
    await advance(100);
    expect(window.location.pathname).toBe('/');
    expect(window.history.length).toBe(entries);
    expect(website).toHaveAttribute('data-opening');
    expect(mobile).not.toHaveAttribute('data-opening');

    // The reload never came, as when the person stops it: nothing stays pressed or blocked.
    await advance(RELOAD_ON_ITS_WAY_MS);
    expect(website).not.toHaveAttribute('data-opening');
    await tap(user, website);
    await advance(100);
    expect(window.location.pathname).toBe('/p/WEB');
  });
});
