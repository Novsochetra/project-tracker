import type { SessionState } from '@tracker/shared';
import { render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fakeClient } from '../../src/api/test/fakeClient';
import { makeBoard } from '../../src/api/test/fixtures';
import { createTestQueryClient } from '../../src/api/test/render';
import { projectSummary } from '../../src/app/test/harness';
import { TrackerApp } from '../../src/app/TrackerApp';
import { skipAnimations } from '../../src/overlays/testing';

// Paths that are not a route showed the fallback screen but kept the bad URL in the address
// bar, so reloading or sharing it carried the mistake along.

const OPEN_SESSION: SessionState = { authRequired: false, authenticated: true };

function renderApp(path: string) {
  window.history.replaceState(null, '', path);
  const client = fakeClient({
    getSession: () => Promise.resolve(OPEN_SESSION),
    listProjects: () => Promise.resolve([projectSummary()]),
    getBoard: () => Promise.resolve(makeBoard()),
  });
  render(<TrackerApp client={client} queryClient={createTestQueryClient()} />);
}

let restore: Array<() => void> = [];

beforeEach(() => {
  restore = [skipAnimations()];
});

afterEach(() => {
  restore.forEach((undo) => undo());
  window.history.replaceState(null, '', '/');
});

describe('regression: unknown paths are replaced with the screen they show', () => {
  it.each([
    ['/x/y/z', '/'],
    ['/p/MOB/3/extra', '/'],
    ['/p/MOB/abc', '/p/MOB'],
    ['/p/MOB/', '/p/MOB'],
  ])('%s becomes %s', async (path, canonical) => {
    renderApp(path);
    await waitFor(() => expect(window.location.pathname).toBe(canonical));
  });

  it('keeps the history length, so Back still leaves the app', async () => {
    const before = window.history.length;
    renderApp('/x/y/z');
    await waitFor(() => expect(window.location.pathname).toBe('/'));
    expect(window.history.length).toBe(before);
  });
});
