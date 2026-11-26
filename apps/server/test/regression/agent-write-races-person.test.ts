import type { TrackerClient } from '@tracker/client';
import type { ProjectDetail } from '@tracker/shared';
import type { KyselyPlugin, QueryId } from 'kysely';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import type { Db, TicketRow } from '../../src/db/schema';
import { agent, statusOf } from '../helpers/fixtures';
import { clientFor, DIALECTS, useTestServer } from '../helpers/server';

type PersonWrite = Partial<Pick<TicketRow, 'statusId' | 'title' | 'description'>>;

type Write = (claude: TrackerClient) => Promise<unknown>;

// On Postgres (READ COMMITTED) the person's commit can land between an agent's read of the ticket
// and its write. SQLite and PGlite run one transaction at a time, so this runs the person's write
// inside the agent's transaction, just after its first read of the statuses.
function racing(db: Db, ticketId: string, personWrite: PersonWrite): Db {
  const transaction = () => ({
    execute: <T>(work: (trx: Db) => Promise<T>) =>
      db.transaction().execute((trx) => {
        const reads = new Set<QueryId>();
        let landed = false;
        const plugin: KyselyPlugin = {
          transformQuery({ node, queryId }) {
            if (node.kind === 'SelectQueryNode' && JSON.stringify(node).includes('"statuses"')) {
              reads.add(queryId);
            }

            return node;
          },

          async transformResult({ queryId, result }) {
            if (!landed && reads.has(queryId)) {
              landed = true;
              await trx
                .updateTable('tickets')
                .set(personWrite)
                .where('id', '=', ticketId)
                .execute();
            }

            return result;
          },
        };

        return work(trx.withPlugin(plugin));
      }),
  });

  // Bound to the real Kysely, whose methods read its private fields.
  return new Proxy(db, {
    get(target, name) {
      if (name === 'transaction') return transaction;
      const value = Reflect.get(target, name, target) as unknown;

      return typeof value === 'function' ? (value as () => unknown).bind(target) : value;
    },
  });
}

// PT-276 review: an agent's move out of a status, its submit or its text edit wrote over a person's
// move to Done or text save that landed after the agent read the ticket, since only claims made
// their write conditional. The Done rule and the kept old text held for a ticket that had changed.
describe.each(DIALECTS)('regression: an agent write races the person (%s)', (dialect) => {
  const api = useTestServer(dialect);
  let statuses: Record<'todo' | 'doing' | 'reviewed' | 'done', string>;

  const detail = () => api.client().getTicket('MOB-1');

  const agentWhile = (ticketId: string, personWrite: PersonWrite) =>
    clientFor(
      createApp({
        db: racing(api.db, ticketId, personWrite),
        storage: api.storage,
        events: api.broadcaster,
      }),
      { actor: agent() },
    );

  // The person's write runs inside the agent's transaction here, so the refusal rolls it back too:
  // what counts is the 409, and that the agent's write never landed.
  async function refusedWhile(personWrite: PersonWrite, write: Write, code: string) {
    const before = await detail();

    await expect(write(agentWhile(before.ticket.id, personWrite))).rejects.toMatchObject({
      status: 409,
      code,
    });
    expect(await detail()).toEqual(before);
  }

  beforeEach(async () => {
    const project: ProjectDetail = await api.client().createProject({ name: 'Mobile', key: 'MOB' });
    statuses = {
      todo: statusOf(project, 'todo').id,
      doing: statusOf(project, 'in_progress').id,
      reviewed: statusOf(project, 'reviewed').id,
      done: statusOf(project, 'done').id,
    };
  });

  it('refuses a status change once the person moved the ticket to Done', async () => {
    await api.client().createTicket('MOB', { title: 'Crash', statusId: statuses.reviewed });
    const toDone = { statusId: statuses.done };

    await refusedWhile(
      toDone,
      (claude) => claude.updateTicket('MOB-1', { statusId: statuses.todo }),
      'conflict',
    );
    await refusedWhile(
      toDone,
      (claude) => claude.moveTicket('MOB-1', { statusId: statuses.todo }),
      'conflict',
    );
  });

  it('refuses a reorder that would take the ticket back out of Done', async () => {
    await api.client().createTicket('MOB', { title: 'Crash' });
    const other = await api.client().createTicket('MOB', { title: 'Freeze' });

    await refusedWhile(
      { statusId: statuses.done },
      (claude) => claude.moveTicket('MOB-1', { statusId: statuses.todo, beforeId: other.id }),
      'conflict',
    );
  });

  it('refuses a submit once the person moved the ticket to Done', async () => {
    await api.client().createTicket('MOB', { title: 'Crash', statusId: statuses.doing });

    await refusedWhile(
      { statusId: statuses.done },
      (claude) => claude.submitForReview('MOB-1', { summary: 'Fixed' }),
      'conflict',
    );
  });

  it('refuses a text edit over text the person saved meanwhile', async () => {
    await api.client().createTicket('MOB', { title: 'Crash', description: 'A' });

    await refusedWhile(
      { description: 'B' },
      (claude) => claude.updateTicket('MOB-1', { description: 'C' }),
      'stale',
    );
    await refusedWhile(
      { title: 'Crash on launch' },
      (claude) => claude.updateTicket('MOB-1', { title: 'Freeze' }),
      'stale',
    );
  });

  it('lets the write land when what the agent read is still there', async () => {
    const { id } = await api
      .client()
      .createTicket('MOB', { title: 'Crash', description: 'A', statusId: statuses.reviewed });
    const claude = agentWhile(id, { title: 'Crash', description: 'A' });

    await expect(
      claude.updateTicket('MOB-1', { statusId: statuses.todo, description: 'C' }),
    ).resolves.toMatchObject({ statusId: statuses.todo, description: 'C' });
  });
});
