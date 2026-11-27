import { randomUUID } from 'node:crypto';
import {
  PENDING_ATTACHMENT_TTL_MS,
  QUESTION_DEADLINE_MS,
  type Attachment,
  type TicketDetail,
  type TicketQuestion,
} from '@tracker/shared';
import { sql } from 'kysely';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { MIGRATIONS } from '../../src/db/migrations';
import { createMigrator, migrateToLatest } from '../../src/db/migrator';
import type { Db } from '../../src/db/schema';
import { createBroadcaster } from '../../src/events/broadcaster';
import { removeStalePendingAttachments } from '../../src/services/attachments';
import { createMemoryStorage, type MemoryStorage } from '../../src/storage/memoryStorage';
import { agent, fileUpload, imageUpload } from '../helpers/fixtures';
import { clientFor, DIALECTS, openEmptyDatabase } from '../helpers/server';
import { portableSchema } from '../helpers/schemaShape';

const FIRST_DROP = '0038_drop_claude_run_columns';
const BEFORE_DROP = Object.fromEntries(
  Object.entries(MIGRATIONS).filter(([name]) => name < FIRST_DROP),
);
const NOW = Date.now();

const CLAUDE_RUN_TABLES = [
  'runners',
  'runs',
  'run_steps',
  'run_requests',
  'run_changes',
  'ticket_viewed_files',
  'chats',
  'chat_messages',
  'chat_card_tickets',
  'chat_queue',
  'chat_changes',
  'chat_git_actions',
];

interface OldTracker {
  app: ReturnType<typeof createApp>;
  questionId: string;
  ticketFile: Attachment;
  chatFile: Attachment;
}

async function leaveRunRows(db: Db, projectId: string, ticketId: string): Promise<string> {
  const runId = randomUUID();
  const runner = randomUUID();
  await sql`insert into runners (id, name, project_ids, created_at, last_seen_at)
    values (${runner}, 'Dara’s MacBook', ${JSON.stringify([projectId])}, ${NOW}, ${NOW})`.execute(
    db,
  );
  await sql`insert into runs (id, project_id, ticket_id, runner_id, runner_name, prompt, status,
    created_at, kind, step_count) values (${runId}, ${projectId}, ${ticketId}, ${runner},
    'Dara’s MacBook', 'Go', 'running', ${NOW}, 'ticket', 1)`.execute(db);
  await sql`insert into run_steps (run_id, seq, kind, label, sub_agent, created_at)
    values (${runId}, 1, 'tool', 'Read src/a.ts', 0, ${NOW})`.execute(db);
  await sql`insert into run_requests (id, run_id, kind, label, label_cut, status, created_at,
    expires_at) values (${randomUUID()}, ${runId}, 'permission', 'Run npm test', 0, 'open',
    ${NOW}, ${NOW + QUESTION_DEADLINE_MS})`.execute(db);
  await sql`insert into run_changes (run_id, ticket_id, diff, cut, created_at)
    values (${runId}, ${ticketId}, '', 0, ${NOW})`.execute(db);
  await sql`insert into ticket_viewed_files (ticket_id, path, digest, created_at)
    values (${ticketId}, 'src/a.ts', 'd', ${NOW})`.execute(db);

  return runId;
}

async function leaveChatWork(db: Db, chatId: string, messageId: string): Promise<void> {
  await sql`insert into chat_queue (message_id, chat_id, runner_id, ask_model, ask_mode,
    ask_effort, position) values (${messageId}, ${chatId}, 'runner', 'default', 'default',
    'default', 0)`.execute(db);
  await sql`insert into chat_changes (chat_id, version, runner_id, tree, diff, cut, files,
    gh_ready, created_at) values (${chatId}, 'v1', 'runner', 't', '', 0, '[]', 0, ${NOW})`.execute(
    db,
  );
  await sql`insert into chat_git_actions (id, chat_id, runner_id, kind, input, status, created_at)
    values (${randomUUID()}, ${chatId}, 'runner', 'commit', '{}', 'done', ${NOW})`.execute(db);
}

async function leaveChat(db: Db, projectId: string, ticketId: string): Promise<string> {
  const chatId = randomUUID();
  const messageId = randomUUID();
  await sql`insert into chats (id, project_id, title, created_at, updated_at, ticket_id)
    values (${chatId}, ${projectId}, 'Login bug', ${NOW}, ${NOW}, ${ticketId})`.execute(db);
  await sql`insert into chat_messages (id, chat_id, role, text, created_at)
    values (${messageId}, ${chatId}, 'person', 'Look', ${NOW})`.execute(db);
  await sql`insert into chat_card_tickets (message_id, card_index, ticket_id)
    values (${messageId}, 0, ${ticketId})`.execute(db);
  await leaveChatWork(db, chatId, messageId);

  return messageId;
}

async function leaveLineComment(db: Db, ticketId: string, runId: string): Promise<void> {
  await sql`insert into activities (id, ticket_id, type, actor_kind, actor_name, text, created_at,
    line_run_id, line_path, line_side, line_number) values (${randomUUID()}, ${ticketId},
    'comment', 'human', '', 'Use 4 here.', ${NOW}, ${runId}, 'src/a.ts', 'new', 2)`.execute(db);
}

async function leaveQuestion(db: Db, ticketId: string, runId: string): Promise<string> {
  const id = randomUUID();
  await sql`insert into questions (id, ticket_id, run_id, text, choices, status, created_at,
    expires_at) values (${id}, ${ticketId}, ${runId}, 'Which name should the setting have?',
    ${JSON.stringify(['Dark', 'Night'])}, 'open', ${NOW}, ${NOW + QUESTION_DEADLINE_MS})`.execute(
    db,
  );

  return id;
}

// A tracker as the release before the drop left it: rows in every Claude-run table around a ticket
// with a file, a comment made on a line of a run's changes and a question asked during a run.
async function oldTracker(db: Db, storage: MemoryStorage): Promise<OldTracker> {
  expect((await createMigrator(db, BEFORE_DROP).migrateToLatest()).error).toBeUndefined();
  const app = createApp({ db, storage, events: createBroadcaster() });
  const upload = async (request: ReturnType<typeof fileUpload>) =>
    (await (await app.request(request.path, request.init)).json()) as Attachment;
  const { project } = await clientFor(app).createProject({ name: 'Mobile', key: 'MOB' });
  const ticket = await clientFor(app).createTicket('MOB', { title: 'Crash' });
  const ticketFile = await upload(fileUpload({ ticketKey: 'MOB-1' }));
  const chatFile = await upload(imageUpload());
  const runId = await leaveRunRows(db, project.id, ticket.id);
  await leaveLineComment(db, ticket.id, runId);
  const questionId = await leaveQuestion(db, ticket.id, runId);
  // A file sent in a chat on the release before 0036 while the deploy that ran 0036 went out.
  const messageId = await leaveChat(db, project.id, ticket.id);
  await sql`update attachments set chat_message_id = ${messageId}
    where id = ${chatFile.id}`.execute(db);
  await sql`update projects set auto_review = 1`.execute(db);
  await sql`update tickets set needs_device = 1`.execute(db);

  return { app, questionId, ticketFile, chatFile };
}

async function emptyRunTables(db: Db): Promise<string[]> {
  const counts = await Promise.all(
    CLAUDE_RUN_TABLES.map(async (table) => {
      const { rows } = await sql<{ count: number | string }>`select count(*) as count
        from ${sql.table(table)}`.execute(db);

      return Number(rows[0]?.count ?? 0) === 0 ? [table] : [];
    }),
  );

  return counts.flat();
}

const attachmentRows = (db: Db) =>
  db.selectFrom('attachments').select(['id', 'ticketId', 'activityId']).orderBy('id').execute();

describe.each(DIALECTS)('the drop of the Claude-run tables and columns (%s)', (dialect) => {
  it('drops them all and keeps every core row', async () => {
    const db = openEmptyDatabase(dialect);
    const storage = createMemoryStorage();
    try {
      const { app, ticketFile, chatFile } = await oldTracker(db, storage);
      const before = await attachmentRows(db);
      expect(await emptyRunTables(db)).toEqual([]);

      await migrateToLatest(db);
      const tables = Object.keys(await portableSchema(db, dialect));
      expect(tables.filter((table) => CLAUDE_RUN_TABLES.includes(table))).toEqual([]);
      expect(await attachmentRows(db)).toEqual(before);
      expect(before.map((row) => row.id).sort()).toEqual([chatFile.id, ticketFile.id].sort());
      const detail = (await clientFor(app).getTicket('MOB-1')) satisfies TicketDetail;
      expect(detail.ticket.title).toBe('Crash');
      expect(detail.activity.map((item) => item.text)).toContain('Use 4 here.');
      expect(detail.attachments.map((file) => file.id)).toEqual([ticketFile.id]);
    } finally {
      await db.destroy();
    }
  });

  it('answers the question asked during a run, and takes new questions and files', async () => {
    const db = openEmptyDatabase(dialect);
    const storage = createMemoryStorage();
    try {
      const { app, questionId } = await oldTracker(db, storage);
      await migrateToLatest(db);

      const answered = await app.request(`/api/questions/${questionId}/answer`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ answer: 'Night' }),
      });
      expect(((await answered.json()) as TicketQuestion).status).toBe('answered');
      const asked = await clientFor(app, { actor: agent() }).askQuestion('MOB-1', {
        question: 'Ship it?',
      });
      expect(asked.status).toBe('open');
      const later = fileUpload({ ticketKey: 'MOB-1' });
      expect((await app.request(later.path, later.init)).status).toBe(201);
    } finally {
      await db.destroy();
    }
  });

  it('leaves a file still linked to a chat message as a pending upload, which the clean-up removes', async () => {
    const db = openEmptyDatabase(dialect);
    const storage = createMemoryStorage();
    try {
      const { app, chatFile, ticketFile } = await oldTracker(db, storage);
      await migrateToLatest(db);

      expect((await app.request('/api/projects/MOB', { method: 'DELETE' })).status).toBe(204);
      expect(await attachmentRows(db)).toEqual([
        { id: chatFile.id, ticketId: null, activityId: null },
      ]);
      const stored = [...storage.files.keys()];
      expect(stored.filter((key) => key.startsWith(chatFile.id))).toHaveLength(1);
      expect(stored.filter((key) => key.startsWith(ticketFile.id))).toEqual([]);

      const dayOld = chatFile.createdAt + PENDING_ATTACHMENT_TTL_MS + 1;
      expect(await removeStalePendingAttachments({ db, storage }, dayOld)).toBe(1);
      expect(await attachmentRows(db)).toEqual([]);
      expect(storage.files.size).toBe(0);
    } finally {
      await db.destroy();
    }
  });
});
