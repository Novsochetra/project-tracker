import type {
  ErrorBody,
  ListTicketsQuery,
  ProjectDetail,
  Review,
  TicketListItem,
  TicketsAcrossProjects,
} from '@tracker/shared';
import type { KyselyPlugin } from 'kysely';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { createBroadcaster } from '../../src/events/broadcaster';
import { createMemoryStorage } from '../../src/storage/memoryStorage';
import { agent, statusOf } from '../helpers/fixtures';
import { clientFor, DIALECTS, useTestServer } from '../helpers/server';

const keys = (items: TicketListItem[]) => items.map((ticket) => ticket.key);

function countingPlugin() {
  const counter = { queries: 0 };
  const plugin: KyselyPlugin = {
    transformQuery: (args) => {
      counter.queries += 1;
      return args.node;
    },
    transformResult: (args) => Promise.resolve(args.result),
  };
  return { plugin, counter };
}

describe.each(DIALECTS)('ticket lists (%s)', (dialect) => {
  const api = useTestServer(dialect);
  const reviewer = () => api.client(agent('Reviewer'));
  const worker = () => api.client(agent('Worker'));
  let mobile: ProjectDetail;
  let web: ProjectDetail;

  beforeEach(async () => {
    mobile = await api.client().createProject({ name: 'Mobile app', key: 'MOB' });
    web = await api.client().createProject({ name: 'Website', key: 'WEB' });
  });

  const waitingForReview = (project: ProjectDetail, title: string) =>
    api
      .client()
      .createTicket(project.project.key, { title, statusId: statusOf(project, 'in_review').id });

  const approve = (key: string, rating: number) =>
    reviewer().reviewTicket(key, { verdict: 'approved', rating, summary: 'Looks right.' });

  const sendBack = (key: string, rating: number) =>
    reviewer().reviewTicket(key, { verdict: 'changes_requested', rating, summary: 'Add a test.' });

  describe('GET /api/tickets', () => {
    it('lists reviewed tickets from every project, most recently updated first', async () => {
      await waitingForReview(mobile, 'Crash on rotate');
      await waitingForReview(web, 'Pricing layout');
      await waitingForReview(mobile, 'Cache avatars');
      await api.client().createTicket('MOB', { title: 'Still to do' });
      await approve('WEB-1', 4);
      await approve('MOB-1', 5);
      await approve('MOB-2', 3);

      const res = await api.get<TicketsAcrossProjects>('/api/tickets?category=reviewed');
      expect(res.status).toBe(200);
      expect(keys(res.body.tickets)).toEqual(['MOB-2', 'MOB-1', 'WEB-1']);
      expect(res.body.tickets.find((ticket) => ticket.key === 'WEB-1')).toMatchObject({
        projectId: web.project.id,
        title: 'Pricing layout',
        statusId: statusOf(web, 'reviewed').id,
        lastReview: { verdict: 'approved', rating: 4 },
      });

      await api.client().updateTicket('WEB-1', { title: 'Pricing page layout' });
      const reordered = await api.client().listAllTickets({ category: 'reviewed' });
      expect(keys(reordered.tickets)).toEqual(['WEB-1', 'MOB-2', 'MOB-1']);
    });

    it('filters by status name in any project, category and search like a project list', async () => {
      const client = api.client();
      const listed = async (query?: ListTicketsQuery) =>
        keys((await client.listAllTickets(query)).tickets);
      await waitingForReview(mobile, 'Crash on rotate');
      await waitingForReview(web, 'Crash on the pricing page');
      await client.createTicket('WEB', { title: 'Hero copy' });
      await approve('MOB-1', 5);
      await approve('WEB-1', 2);
      await client.updateStatus(statusOf(web, 'reviewed').id, { name: 'Checked' });

      expect(await listed()).toEqual(['WEB-1', 'MOB-1', 'WEB-2']);
      expect(await listed({ status: ' reviewed ' })).toEqual(['MOB-1']);
      expect(await listed({ status: 'CHECKED' })).toEqual(['WEB-1']);
      expect(await listed({ category: 'reviewed' })).toEqual(['WEB-1', 'MOB-1']);
      expect(await listed({ category: 'todo' })).toEqual(['WEB-2']);
      expect(await listed({ q: 'crash' })).toEqual(['WEB-1', 'MOB-1']);
      expect(await listed({ q: 'web-2' })).toEqual(['WEB-2']);
      expect(await listed({ status: 'To do', category: 'done' })).toEqual([]);
      expect(await listed({ status: 'Nope' })).toEqual([]);
      const bad = await api.get<ErrorBody>('/api/tickets?category=later');
      expect(bad.status).toBe(400);
      expect(bad.body.error.code).toBe('invalid_input');
    });

    it('sends the statuses of the projects it lists tickets from, in their order', async () => {
      const client = api.client();
      await waitingForReview(mobile, 'Crash on rotate');
      await approve('MOB-1', 4);
      await client.createTicket('WEB', { title: 'Hero copy' });
      const reordered = await client.reorderStatuses(
        'MOB',
        mobile.statuses.map((status) => status.id).reverse(),
      );
      const webStatuses = (await client.getProject('WEB')).statuses;

      const ready = await client.listAllTickets({ category: 'reviewed' });
      expect(keys(ready.tickets)).toEqual(['MOB-1']);
      expect(ready.statuses).toEqual(reordered);

      const all = await client.listAllTickets();
      const ofProject = (id: string) => all.statuses.filter((status) => status.projectId === id);
      expect(ofProject(mobile.project.id)).toEqual(reordered);
      expect(ofProject(web.project.id)).toEqual(webStatuses);
      expect(all.statuses).toHaveLength(reordered.length + webStatuses.length);

      expect(await client.listAllTickets({ q: 'nothing like it' })).toEqual({
        tickets: [],
        statuses: [],
      });
    });
  });

  describe('lastReview on list items', () => {
    const reviewOf = (items: TicketListItem[], key: string): Review | null => {
      const ticket = items.find((item) => item.key === key);
      if (!ticket) throw new Error(`${key} is not in the list`);
      return ticket.lastReview;
    };

    const lastReviews = async (key: string): Promise<(Review | null)[]> => {
      const client = api.client();
      return [
        reviewOf((await client.getBoard('MOB')).tickets, key),
        reviewOf(await client.listTickets('MOB'), key),
        reviewOf((await client.listAllTickets()).tickets, key),
      ];
    };

    it('is null until the ticket is reviewed', async () => {
      await api.client().createTicket('MOB', { title: 'Fresh idea' });
      expect(await lastReviews('MOB-1')).toEqual([null, null, null]);
    });

    it('follows the latest review, through a send-back and a second review', async () => {
      await waitingForReview(mobile, 'Crash on rotate');
      await sendBack('MOB-1', 2);
      const sentBack = { verdict: 'changes_requested', rating: 2 };
      expect(await lastReviews('MOB-1')).toEqual([sentBack, sentBack, sentBack]);

      await worker().claimTicket('MOB-1');
      await worker().submitForReview('MOB-1', { summary: 'Added the test.' });
      expect(await lastReviews('MOB-1')).toEqual([sentBack, sentBack, sentBack]);

      await approve('MOB-1', 4);
      const approved = { verdict: 'approved', rating: 4 };
      expect(await lastReviews('MOB-1')).toEqual([approved, approved, approved]);
    });

    it('falls back to the previous review when the latest one is deleted', async () => {
      await waitingForReview(mobile, 'Crash on rotate');
      await sendBack('MOB-1', 2);
      await worker().submitForReview('MOB-1', { summary: 'Added the test.' });
      await approve('MOB-1', 5);
      const detail = await api.client().getTicket('MOB-1');
      const latest = detail.activity.filter((item) => item.type === 'review').at(-1);
      await api.client().deleteActivity(latest?.id ?? '');
      expect((await lastReviews('MOB-1'))[0]).toEqual({ verdict: 'changes_requested', rating: 2 });
    });

    it('belongs to its own ticket only', async () => {
      await waitingForReview(mobile, 'Reviewed one');
      await api.client().createTicket('MOB', { title: 'Untouched' });
      await approve('MOB-1', 3);
      await api.client().addComment('MOB-2', { text: 'Not a review' });
      expect(await lastReviews('MOB-1')).toEqual(Array(3).fill({ verdict: 'approved', rating: 3 }));
      expect(await lastReviews('MOB-2')).toEqual([null, null, null]);
    });
  });

  it('reads every list with the same number of queries however many tickets it holds', async () => {
    const { plugin, counter } = countingPlugin();
    const app = createApp({
      db: api.db.withPlugin(plugin),
      storage: createMemoryStorage(),
      events: createBroadcaster(),
    });
    const client = clientFor(app);
    const queriesFor = async (read: () => Promise<unknown>) => {
      counter.queries = 0;
      await read();
      return counter.queries;
    };
    const readAll = async () => [
      await queriesFor(() => client.getBoard('MOB')),
      await queriesFor(() => client.listTickets('MOB')),
      await queriesFor(() => client.listAllTickets({ category: 'reviewed' })),
    ];

    await waitingForReview(mobile, 'First');
    await approve('MOB-1', 4);
    const few = await readAll();
    for (let index = 0; index < 6; index += 1) {
      const ticket = await waitingForReview(index % 2 ? web : mobile, `More ${index}`);
      await api.client().addComment(ticket.key, { text: 'Comment' });
      await approve(ticket.key, 3);
    }
    expect((await client.listAllTickets({ category: 'reviewed' })).tickets).toHaveLength(7);
    expect(await readAll()).toEqual(few);
  });
});
