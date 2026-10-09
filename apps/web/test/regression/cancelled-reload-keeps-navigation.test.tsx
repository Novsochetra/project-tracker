import type { SessionState } from '@tracker/shared';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { fakeClient } from '../../src/api/test/fakeClient';
import { makeBoard, otherProject } from '../../src/api/test/fixtures';
import { createTestQueryClient } from '../../src/api/test/render';
import { projectSummary } from '../../src/app/test/harness';
import { TrackerApp } from '../../src/app/TrackerApp';
import { PUSH_WAIT_LIMIT_MS } from '../../src/navigation/pushWait';
import { mockPhone, skipAnimations, tap } from '../../src/overlays/testing';
import { reloadOnPreloadError } from '../../src/pwa/reloadOnPreloadError';

// PT-108 review: once the page had asked for a reload, every push and replace was dropped for the
// life of the page. When the reload didn't happen, nothing opened any more: Chromium cancels a
// reload when a Back comes before the new page arrives, as on a slow first visit where the stalled
// chunk fails and the person presses Back on its loading state.

// The Project screen's chunk hangs, then fails as Vite's preload helper reports it: the event
// first, then the failed import.
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
const layer = (path: string) => document.querySelector<HTMLElement>(`[data-stack-path="${path}"]`);

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

describe('regression: a chunk reload that never happens', () => {
  it('leaves the app’s navigation working', async () => {
    const reload = vi.fn();
    restore.push(reloadOnPreloadError(reload));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderApp();
    const main = await screen.findByRole('main');
    await tap(user, await within(main).findByRole('button', { name: /^Mobile app/ }));
    await advance(PUSH_WAIT_LIMIT_MS);
    const loading = layer('/p/MOB')!;
    expect(within(loading).getByRole('status')).toHaveTextContent('Loading');

    await act(async () => {
      chunk.fail();
      await chunk.loaded.catch(() => undefined);
    });
    expect(reload).toHaveBeenCalledTimes(1);
    await advance(300);
    await user.click(await within(loading).findByRole('button', { name: 'Back' }));
    expect(window.location.pathname).toBe('/');

    await tap(user, await within(main).findByRole('button', { name: /^Website/ }));
    await advance(100);
    expect(window.location.pathname).toBe('/p/WEB');
  });
});
