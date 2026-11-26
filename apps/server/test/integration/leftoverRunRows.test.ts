import { randomUUID } from 'node:crypto';
import {
  PENDING_ATTACHMENT_TTL_MS,
  QUESTION_DEADLINE_MS,
  type Attachment,
  type Ticket,
  type TicketDetail,
  type TicketListItem,
  type TicketQuestion,
} from '@tracker/shared';
import { sql } from 'kysely';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { MIGRATIONS } from '../../src/db/migrations';
import { createMigrator, migrateToLatest } from '../../src/db/migrator';
import type { Db } from '../../src/db/schema';
import { createBroadcaster } from '../../src/events/broadcaster';
import { removeStalePendingAttachments } from '../../src/services/attachments';
import { createMemoryStorage } from '../../src/storage/memoryStorage';
import { fileUpload, imageUpload } from '../helpers/fixtures';
import {
  clientFor,
  DIALECTS,
  openEmptyDatabase,
  useTestServer,
  type TestServer,
} from '../helpers/server';

const NOW = Date.now();

interface Place {
  projectId: string;
  ticket: Ticket;
}

// Runs, chats and the other tables of the features that ran Claude Code stay, with their rows,
// until a later release drops them (§2.1). Nothing in the core reads them any more, so these rows
// go in straight, as an older release left them.
async function leaveRunRows(api: TestServer, { projectId, ticket }: Place): Promise<string> {
  const runId = randomUUID();
  await sql`insert into runs (id, project_id, ticket_id, runner_name, prompt, status, created_at,
    kind, step_count) values (${runId}, ${projectId}, ${ticket.id}, 'Dara’s MacBook', 'Go',
    'running', ${NOW}, 'ticket', 1)`.execute(api.db);
  await sql`insert into run_steps (run_id, seq, kind, label, sub_agent, created_at)
    values (${runId}, 1, 'tool', 'Read src/a.ts', 0, ${NOW})`.execute(api.db);
  await sql`insert into run_requests (id, run_id, kind, label, label_cut, status, created_at,
    expires_at) values (${randomUUID()}, ${runId}, 'permission', 'Run npm test', 0, 'open',
    ${NOW}, ${NOW + 2 * QUESTION_DEADLINE_MS})`.execute(api.db);
  await sql`insert into run_changes (run_id, ticket_id, diff, cut, created_at)
    values (${runId}, ${ticket.id}, '', 0, ${NOW})`.execute(api.db);
  await sql`insert into ticket_viewed_files (ticket_id, path, digest, created_at)
    values (${ticket.id}, 'src/a.ts', 'd', ${NOW})`.execute(api.db);

  return runId;
}

async function leaveLineComment(api: TestServer, ticketId: string, runId: string) {
  const id = randomUUID();
  await api.db
    .insertInto('activities')
    .values({
      id,
      ticketId,
      type: 'comment',
      actorKind: 'human',
      actorName: '',
      text: 'Use 4 here.',
      createdAt: NOW,
    })
    .execute();
  await sql`update activities set line_run_id = ${runId}, line_path = ${'src/a.ts'},
    line_side = ${'new'}, line_number = ${2} where id = ${id}`.execute(api.db);
}

async function leaveQuestionOfRun(api: TestServer, ticketId: string, runId: string) {
  const id = randomUUID();
  await api.db
    .insertInto('questions')
    .values({
      id,
      ticketId,
      text: 'Which name should the setting have?',
      choices: JSON.stringify(['Dark', 'Night']),
      status: 'open',
      createdAt: NOW,
      expiresAt: NOW + QUESTION_DEADLINE_MS,
    })
    .execute();
  await sql`update questions set run_id = ${runId} where id = ${id}`.execute(api.db);

  return id;
}

async function leaveChatMessage(db: Db, projectId: string): Promise<string> {
  const chatId = randomUUID();
  const messageId = randomUUID();
  await sql`insert into chats (id, project_id, title, ask_model, ask_mode, ask_effort, created_at,
    updated_at) values (${chatId}, ${projectId}, 'Login bug', 'sonnet', 'ask', 'medium', ${NOW},
    ${NOW})`.execute(db);
  await sql`insert into chat_messages (id, chat_id, role, text, created_at)
    values (${messageId}, ${chatId}, 'person', 'Look', ${NOW})`.execute(db);

  return messageId;
}

const count = async (db: Db, table: string) =>
  (
    await sql<{
      count: number | string;
    }>`select count(*) as count from ${sql.table(table)}`.execute(db)
  ).rows.map((row) => Number(row.count))[0];

const countRows = async (db: Db) => ({
  runs: await count(db, 'runs'),
  runSteps: await count(db, 'run_steps'),
  runRequests: await count(db, 'run_requests'),
  runChanges: await count(db, 'run_changes'),
  viewedFiles: await count(db, 'ticket_viewed_files'),
  questions: await count(db, 'questions'),
  chats: await count(db, 'chats'),
  chatMessages: await count(db, 'chat_messages'),
});

describe.each(DIALECTS)('rows left from runs and chats (%s)', (dialect) => {
  const api = useTestServer(dialect);
  let place: Place;
  let other: Ticket;

  beforeEach(async () => {
    const client = api.client();
    const { project } = await client.createProject({ name: 'Mobile', key: 'MOB' });
    place = { projectId: project.id, ticket: await client.createTicket('MOB', { title: 'Crash' }) };
    other = await client.createTicket('MOB', { title: 'Rename the queue' });
  });

  it('read as a plain ticket, whose open question still takes an answer', async () => {
    const runId = await leaveRunRows(api, place);
    await leaveLineComment(api, place.ticket.id, runId);
    const questionId = await leaveQuestionOfRun(api, place.ticket.id, runId);

    const detail = (await api.get<TicketDetail>('/api/tickets/MOB-1')).body;
    const comment = detail.activity.find((item) => item.type === 'comment');
    expect(comment).toMatchObject({ text: 'Use 4 here.' });
    expect(comment).not.toHaveProperty('line');
    const list = (await api.get<TicketListItem[]>('/api/projects/MOB/tickets')).body;
    expect(list.find((item) => item.key === 'MOB-1')?.waitingUntil).toBe(
      NOW + QUESTION_DEADLINE_MS,
    );

    const answered = await api.post<TicketQuestion>(`/api/questions/${questionId}/answer`, {
      answer: 'Night',
    });
    expect(answered.body).toMatchObject({ status: 'answered', answer: 'Night' });
    expect(answered.body).not.toHaveProperty('runId');
  });

  it('go with the ticket they are on', async () => {
    const runId = await leaveRunRows(api, place);
    await leaveLineComment(api, place.ticket.id, runId);
    await leaveQuestionOfRun(api, place.ticket.id, runId);
    await leaveRunRows(api, { ...place, ticket: other });

    expect((await api.delete('/api/tickets/MOB-1')).status).toBe(204);
    expect(await countRows(api.db)).toMatchObject({
      runs: 1,
      runSteps: 1,
      runRequests: 1,
      runChanges: 1,
      viewedFiles: 1,
      questions: 0,
    });
    const activity = await api.db
      .selectFrom('activities')
      .select('id')
      .where('ticketId', '=', place.ticket.id)
      .execute();
    expect(activity).toEqual([]);
  });

  it('go with their project, and the stored files of its tickets too', async () => {
    await leaveRunRows(api, place);
    await leaveChatMessage(api.db, place.projectId);
    const onTicket = (await api.upload(imageUpload({ ticketKey: 'MOB-2' }))).body;

    expect((await api.delete('/api/projects/MOB')).status).toBe(204);
    expect(await countRows(api.db)).toEqual({
      runs: 0,
      runSteps: 0,
      runRequests: 0,
      runChanges: 0,
      viewedFiles: 0,
      questions: 0,
      chats: 0,
      chatMessages: 0,
    });
    expect(await api.db.selectFrom('attachments').select('id').execute()).toEqual([]);
    expect([...api.storage.files.keys()].some((key) => key.startsWith(onTicket.id))).toBe(false);
  });
});

const BEFORE_UNLINK = Object.fromEntries(
  Object.entries(MIGRATIONS).filter(([name]) => name < '0036_unlink_chat_files'),
);

// A chat's delete cascades to the files linked to its messages, so before 0036 a project's delete
// took a chat file's row and left its stored file with nothing naming it.
describe.each(DIALECTS)('a file sent in a chat before 0036_unlink_chat_files (%s)', (dialect) => {
  it('stays a pending upload when its project goes, which the clean-up then removes', async () => {
    const db = openEmptyDatabase(dialect);
    const storage = createMemoryStorage();
    try {
      expect((await createMigrator(db, BEFORE_UNLINK).migrateToLatest()).error).toBeUndefined();
      const app = createApp({ db, storage, events: createBroadcaster() });
      const upload = async (request: ReturnType<typeof fileUpload>) =>
        (await (await app.request(request.path, request.init)).json()) as Attachment;
      const { project } = await clientFor(app).createProject({ name: 'Mobile', key: 'MOB' });
      await clientFor(app).createTicket('MOB', { title: 'Crash' });
      const onTicket = await upload(fileUpload({ ticketKey: 'MOB-1' }));
      const sent = await upload(imageUpload());
      const messageId = await leaveChatMessage(db, project.id);
      await sql`update attachments set chat_message_id = ${messageId}
        where id = ${sent.id}`.execute(db);

      await migrateToLatest(db);
      const link = await sql`select chat_message_id from attachments where id = ${sent.id}`.execute(
        db,
      );
      expect(link.rows).toEqual([{ chatMessageId: null }]);
      expect((await app.request('/api/projects/MOB', { method: 'DELETE' })).status).toBe(204);
      const rows = await db.selectFrom('attachments').select(['id', 'ticketId']).execute();
      expect(rows).toEqual([{ id: sent.id, ticketId: null }]);
      const stored = [...storage.files.keys()];
      expect(stored.filter((key) => key.startsWith(sent.id))).toHaveLength(1);
      expect(stored.filter((key) => key.startsWith(onTicket.id))).toEqual([]);

      const dayOld = sent.createdAt + PENDING_ATTACHMENT_TTL_MS + 1;
      expect(await removeStalePendingAttachments({ db, storage }, dayOld)).toBe(1);
      expect(await db.selectFrom('attachments').select('id').execute()).toEqual([]);
      expect(storage.files.size).toBe(0);
    } finally {
      await db.destroy();
    }
  });
});
