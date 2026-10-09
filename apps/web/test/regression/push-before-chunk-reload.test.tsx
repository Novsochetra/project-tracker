import type { SessionState } from '@tracker/shared';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { fakeClient } from '../../src/api/test/fakeClient';
import { makeBoard } from '../../src/api/test/fixtures';
import { createTestQueryClient } from '../../src/api/test/render';
import { projectSummary } from '../../src/app/test/harness';
import { TrackerApp } from '../../src/app/TrackerApp';
import { mockPhone, skipAnimations, tap } from '../../src/overlays/testing';
import { reloadOnPreloadError } from '../../src/pwa/reloadOnPreloadError';

// PT-108: a screen's chunk that answered 404 (a page still on an old build) reloads the page
// through the vite:preloadError rule, yet the push that waited for that chunk still went, after
// the reload was asked for. The reload then loaded the screen on show into the pushed entry, so
// the history held Projects twice and the browser's Back stayed on Projects.

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

function renderApp() {
  window.history.replaceState(null, '', '/');
  const client = fakeClient({
    getSession: () => Promise.resolve(OPEN_SESSION),
    listProjects: () => Promise.resolve([projectSummary({ openCount: 3 })]),
    listAllTickets: () => Promise.resolve({ tickets: [], statuses: [] }),
    getBoard: () => Promise.resolve(makeBoard()),
  });
  render(<TrackerApp client={client} queryClient={createTestQueryClient()} />);
}

let restore: Array<() => void> = [];
let consoleError: MockInstance<typeof console.error>;

beforeEach(() => {
  restore = [skipAnimations(), mockPhone(true)];
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  restore.forEach((undo) => undo());
  consoleError.mockRestore();
  window.sessionStorage.clear();
  window.history.replaceState(null, '', '/');
});

describe('regression: a push whose chunk fails and reloads the page', () => {
  it('adds no history entry once the reload is asked for', async () => {
    const reload = vi.fn();
    restore.push(reloadOnPreloadError(reload));
    const user = userEvent.setup();
    renderApp();
    const main = await screen.findByRole('main');
    const row = await within(main).findByRole('button', { name: /^Mobile app/ });
    const entries = window.history.length;
    await tap(user, row);

    await act(async () => {
      chunk.fail();
      await chunk.loaded.catch(() => undefined);
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(reload).toHaveBeenCalledTimes(1);
    expect(window.location.pathname).toBe('/');
    expect(window.history.length).toBe(entries);
  });
});
