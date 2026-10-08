import type { Activity, TicketDetail, UpdateTicketInput } from '@tracker/shared';
import { act } from '@testing-library/react';
import { vi, type MockInstance } from 'vitest';

const REQUEST_MS = 5;

function withFields(detail: TicketDetail, input: UpdateTicketInput): TicketDetail {
  const assignee = input.assignee?.trim();
  return {
    ...detail,
    ticket: { ...detail.ticket, ...input, ...(assignee === undefined ? {} : { assignee }) },
  };
}

function withCommentText(detail: TicketDetail, activityId: string, text: string): TicketDetail {
  const activity = detail.activity.map((item) =>
    item.id === activityId ? { ...item, text: text.trim(), editedAt: Date.now() } : item,
  );
  return { ...detail, activity };
}

// Answers like the real tracker: reads return what was saved, and while it can't be reached
// every request fails a moment later, after the optimistic update has rendered.
export function fakeTicketServer(initial: TicketDetail) {
  let detail = initial;
  let reachable = true;
  const answer = <T>(value: () => T): Promise<T> =>
    new Promise((resolve, reject) => {
      setTimeout(() => {
        if (reachable) resolve(value());
        else reject(new TypeError('Failed to fetch'));
      }, REQUEST_MS);
    });
  const client = {
    getTicket: vi.fn(() => answer(() => detail)),
    updateTicket: vi.fn((_key: string, input: UpdateTicketInput) =>
      answer(() => {
        detail = withFields(detail, input);
        return detail.ticket;
      }),
    ),
    updateComment: vi.fn((activityId: string, input: { text: string }) =>
      answer(() => {
        detail = withCommentText(detail, activityId, input.text);
        return detail.activity.find((item) => item.id === activityId) as Activity;
      }),
    ),
  };
  return {
    client,
    get detail() {
      return detail;
    },
    // Someone else, such as an agent, changes the ticket.
    edit: (input: UpdateTicketInput) => {
      detail = withFields(detail, input);
    },
    setReachable: (value: boolean) => {
      reachable = value;
    },
  };
}

export type FakeTicketServer = ReturnType<typeof fakeTicketServer>;

let onLine: MockInstance<() => boolean> | undefined;

export function goOffline(server: FakeTicketServer): void {
  server.setReachable(false);
  onLine ??= vi.spyOn(navigator, 'onLine', 'get');
  onLine.mockReturnValue(false);
}

export function goOnline(server: FakeTicketServer): void {
  server.setReachable(true);
  onLine?.mockReturnValue(true);
  act(() => {
    window.dispatchEvent(new Event('online'));
  });
}

export function restoreOnLine(): void {
  onLine?.mockRestore();
  onLine = undefined;
}
