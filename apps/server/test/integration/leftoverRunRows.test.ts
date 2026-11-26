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
import { removeStalePendingAttachments } from '../../src/services/attachments';
import { imageUpload } from '../helpers/fixtures';
import { DIALECTS, useTestServer, type TestServer } from '../helpers/server';

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

async function leaveChatFile(api: TestServer, projectId: string): Promise<Attachment> {
  const chatId = randomUUID();
  const messageId = randomUUID();
  await api.db
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
  await api.db
    .insertInto('chatMessages')
    .values({ id: messageId, chatId, role: 'person', text: 'Look', createdAt: NOW })
    .execute();
  const file = (await api.upload(imageUpload())).body;
  await api.db
    .updateTable('attachments')
    .set({ chatMessageId: messageId })
    .where('id', '=', file.id)
    .execute();

  return file;
}

const countRows = async (api: TestServer) => ({
  runs: (await api.db.selectFrom('runs').select('id').execute()).length,
  runSteps: (await api.db.selectFrom('runSteps').select('runId').execute()).length,
  runRequests: (await api.db.selectFrom('runRequests').select('id').execute()).length,
  runChanges: (await api.db.selectFrom('runChanges').select('runId').execute()).length,
  viewedFiles: (await api.db.selectFrom('ticketViewedFiles').select('path').execute()).length,
  questions: (await api.db.selectFrom('questions').select('id').execute()).length,
  chats: (await api.db.selectFrom('chats').select('id').execute()).length,
  chatMessages: (await api.db.selectFrom('chatMessages').select('id').execute()).length,
  attachments: (await api.db.selectFrom('attachments').select('id').execute()).length,
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
    expect(await countRows(api)).toMatchObject({
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

  it('go with their project, chats and the rows of the files sent in them too', async () => {
    await leaveRunRows(api, place);
    await leaveChatFile(api, place.projectId);
    const onTicket = (await api.upload(imageUpload({ ticketKey: 'MOB-2' }))).body;

    expect((await api.delete('/api/projects/MOB')).status).toBe(204);
    expect(await countRows(api)).toEqual({
      runs: 0,
      runSteps: 0,
      runRequests: 0,
      runChanges: 0,
      viewedFiles: 0,
      questions: 0,
      chats: 0,
      chatMessages: 0,
      attachments: 0,
    });
    expect([...api.storage.files.keys()].some((key) => key.startsWith(onTicket.id))).toBe(false);
  });

  it('leave a file sent in a chat to the start-up clean-up once it is a day old', async () => {
    const sent = await leaveChatFile(api, place.projectId);
    expect(api.storage.files.size).toBe(1);

    const deps = { db: api.db, storage: api.storage };
    const dayOld = sent.createdAt + PENDING_ATTACHMENT_TTL_MS + 1;
    expect(await removeStalePendingAttachments(deps, dayOld - 2)).toBe(0);
    expect(await removeStalePendingAttachments(deps, dayOld)).toBe(1);
    expect(await api.db.selectFrom('attachments').select('id').execute()).toEqual([]);
    expect(api.storage.files.size).toBe(0);
  });
});
