import { act, renderHook } from '@testing-library/react';
import type { Ticket } from '@tracker/shared';
import { createElement, type ReactNode } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { listItem, STATUS } from '../../src/api/test/fixtures';
import { setupApi } from '../../src/api/test/render';
import { createReachability } from '../../src/app/reachability';
import { ToastProvider } from '../../src/components';
import { QUEUE_STORAGE_KEY, readQueue } from '../../src/features/capture/queueStore';
import { useCaptureSync } from '../../src/features/capture/useCaptureSync';

// WebKit kept navigator.onLine false for 20 minutes while every request was answered (PT-179), and
// a capture saved on the phone was never sent: the sync didn't try while the browser said offline.

function created(): Ticket {
  const { commentCount: _c, attachmentCount: _a, ...ticket } = listItem(1, STATUS.todo, 0);
  return ticket;
}

function storeCapture() {
  const capture = {
    id: 'a',
    projectKey: 'MOB',
    title: 'Idea a',
    description: '',
    priority: 'medium',
    capturedAt: 10,
  };
  localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify({ items: [capture], created: [] }));
}

function renderSync(createTicket: () => Promise<Ticket>) {
  const api = setupApi({ createTicket });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(api.wrapper, null, createElement(ToastProvider, null, children));
  renderHook(() => useCaptureSync(createReachability()), { wrapper });
}

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it('sends a saved capture while the browser says it is offline and the tracker answers', async () => {
  storeCapture();
  const createTicket = vi.fn(() => Promise.resolve(created()));
  renderSync(createTicket);

  await act(() => vi.advanceTimersByTimeAsync(0));

  expect(createTicket).toHaveBeenCalledTimes(1);
  expect(readQueue().items).toEqual([]);
});

it('keeps the capture when the request gets no answer', async () => {
  storeCapture();
  const createTicket = vi.fn(() => Promise.reject(new TypeError('Load failed')));
  renderSync(createTicket);

  await act(() => vi.advanceTimersByTimeAsync(0));

  expect(createTicket).toHaveBeenCalledTimes(1);
  expect(readQueue().items.map((item) => item.id)).toEqual(['a']);
});
