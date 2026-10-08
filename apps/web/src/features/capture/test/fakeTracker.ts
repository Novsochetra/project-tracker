import type { CreateTicketInput, ListTicketsQuery, Ticket } from '@tracker/shared';
import { listItem, STATUS } from '../../../api/test/fixtures';

interface Made {
  projectKey: string;
  clientId: string | undefined;
  ticket: Ticket;
}

// Like the server, a create that repeats a client id in a project gets the ticket the first one
// made (apps/server/test/integration/clientIds.test.ts).
export function fakeTracker() {
  const made: Made[] = [];
  const earlier = (projectKey: string, clientId: string | undefined) =>
    clientId === undefined
      ? undefined
      : made.find((entry) => entry.projectKey === projectKey && entry.clientId === clientId);

  const create = (projectKey: string, input: CreateTicketInput): Ticket => {
    const repeated = earlier(projectKey, input.clientId);
    if (repeated) return repeated.ticket;
    const num = made.filter((entry) => entry.projectKey === projectKey).length + 1;
    const {
      commentCount: _c,
      attachmentCount: _a,
      lastReview: _r,
      ...ticket
    } = listItem(num, STATUS.todo, 0, {
      key: `${projectKey}-${num}`,
      title: input.title,
      description: input.description ?? '',
    });
    made.push({ projectKey, clientId: input.clientId, ticket });
    return ticket;
  };

  const search = (projectKey: string, query: ListTicketsQuery = {}): Ticket[] => {
    const text = (query.q ?? '').trim().toLowerCase();
    return made
      .filter((entry) => entry.projectKey === projectKey)
      .map((entry) => entry.ticket)
      .filter((ticket) => ticket.title.toLowerCase().includes(text));
  };

  return { create, search, titles: () => made.map((entry) => entry.ticket.title) };
}
