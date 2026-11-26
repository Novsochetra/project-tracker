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
  await api.db
    .insertInto('runs')
    .values({
      id: runId,
      projectId,
      ticketId: ticket.id,
      runnerName: 'Dara’s MacBook',
      prompt: 'Go',
      status: 'running',
      createdAt: NOW,
      kind: 'ticket',
      stepCount: 1,
    })
    .execute();
  await api.db
    .insertInto('runSteps')
    .values({ runId, seq: 1, kind: 'tool', label: 'Read src/a.ts', subAgent: 0, createdAt: NOW })
    .execute();
  await api.db
    .insertInto('runRequests')
    .values({
      id: randomUUID(),
      runId,
      kind: 'permission',
      label: 'Run npm test',
      labelCut: 0,
      status: 'open',
      createdAt: NOW,
      expiresAt: NOW + 2 * QUESTION_DEADLINE_MS,
    })
    .execute();
  await api.db
    .insertInto('runChanges')
    .values({ runId, ticketId: ticket.id, diff: '', cut: 0, createdAt: NOW })
    .execute();
  await api.db
    .insertInto('ticketViewedFiles')
    .values({ ticketId: ticket.id, path: 'src/a.ts', digest: 'd', createdAt: NOW })
    .execute();

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
  await db
    .insertInto('chats')
    .values({
      id: chatId,
      projectId,
      title: 'Login bug',
      askModel: 'sonnet',
      askMode: 'ask',
      askEffort: 'medium',
      createdAt: NOW,
      updatedAt: NOW,
    })
    .execute();
  await db
    .insertInto('chatMessages')
    .values({ id: messageId, chatId, role: 'person', text: 'Look', createdAt: NOW })
    .execute();

  return messageId;
}

const countRows = async (db: Db) => ({
  runs: (await db.selectFrom('runs').select('id').execute()).length,
  runSteps: (await db.selectFrom('runSteps').select('runId').execute()).length,
  runRequests: (await db.selectFrom('runRequests').select('id').execute()).length,
  runChanges: (await db.selectFrom('runChanges').select('runId').execute()).length,
  viewedFiles: (await db.selectFrom('ticketViewedFiles').select('path').execute()).length,
  questions: (await db.selectFrom('questions').select('id').execute()).length,
  chats: (await db.selectFrom('chats').select('id').execute()).length,
  chatMessages: (await db.selectFrom('chatMessages').select('id').execute()).length,
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
      const link = db.selectFrom('attachments').select('chatMessageId').where('id', '=', sent.id);
      expect(await link.executeTakeFirst()).toEqual({ chatMessageId: null });
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
