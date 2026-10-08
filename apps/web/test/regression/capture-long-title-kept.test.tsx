import { ApiError } from '@tracker/client';
import type { Ticket } from '@tracker/shared';
import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { listItem, STATUS } from '../../src/api/test/fixtures';
import { createReachability } from '../../src/app/reachability';
import { SheetsProvider } from '../../src/app/sheets/SheetsProvider';
import { projectSummary, renderWithApp, type HarnessOptions } from '../../src/app/test/harness';
import type { QueuedCapture } from '../../src/features/capture/captureQueue';
import { QUEUE_STORAGE_KEY, readQueue } from '../../src/features/capture/queueStore';
import { QuickCapture } from '../../src/features/capture/QuickCapture';

// Before sending an attempted capture again, the sync looked for its ticket by searching for the
// title. Titles may be 300 characters long but a search at most 200, so a long title got a 400,
// which the sync took for a refusal of the capture: it dropped it and no ticket was ever made.
// The sync no longer looks captures up: it sends them again with their client id.

const LONG_TITLE = `Long title ${'x'.repeat(230)} with words at the end`;

const capture = (overrides: Partial<QueuedCapture> = {}): QueuedCapture => ({
  id: 'long',
  projectKey: 'MOB',
  title: LONG_TITLE,
  description: 'Steps',
  priority: 'medium',
  capturedAt: 1_000,
  ...overrides,
});

const ticket = (title: string, description = 'Steps'): Ticket => {
  const {
    commentCount: _c,
    attachmentCount: _a,
    ...rest
  } = listItem(1, STATUS.todo, 0, {
    title,
    description,
    createdAt: 2_000,
  });
  return rest;
};

function storeQueue(items: QueuedCapture[]) {
  window.localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify({ items, created: [] }));
}

function renderSync(client: HarnessOptions['client']) {
  renderWithApp(
    <SheetsProvider>
      <QuickCapture reachability={createReachability()} />
    </SheetsProvider>,
    { projects: [projectSummary()], client },
  );
}

afterEach(() => {
  window.localStorage.clear();
});

describe('regression: a capture with a long title is never lost', () => {
  it('sends it again with its client id and adds it', async () => {
    storeQueue([capture()]);
    const createTicket = vi.fn((_key: string, input: { title: string }) =>
      Promise.resolve(ticket(input.title)),
    );
    renderSync({ createTicket });

    expect(await screen.findByText('1 ticket added')).toBeInTheDocument();
    expect(createTicket).toHaveBeenCalledTimes(1);
    expect(createTicket).toHaveBeenCalledWith(
      'MOB',
      expect.objectContaining({ title: LONG_TITLE, clientId: 'long' }),
    );
    expect(readQueue().items).toEqual([]);
  });

  it('names a capture the server refuses for good in a toast short enough for a phone', async () => {
    storeQueue([capture({ projectKey: 'OLD' })]);
    const refused = new ApiError(404, 'not_found', 'Project OLD was not found.');
    renderSync({ createTicket: vi.fn().mockRejectedValue(refused) });

    const toast = await screen.findByText(/^Couldn't add/);
    // About 40 characters fit on one line in a 375px toast (checked in WebKit and Chromium).
    expect(toast.textContent).toMatch(/^Couldn't add “Long title x+…”$/);
    expect(toast.textContent?.length).toBeLessThanOrEqual(40);
    expect(readQueue().items).toEqual([]);
  });
});
