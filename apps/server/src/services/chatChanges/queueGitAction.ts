import { randomUUID } from 'node:crypto';
import {
  ACTIVE_RUN_STATUSES,
  GH_NOT_SET_UP,
  isProtectedBranch,
  PROTECTED_BRANCH,
  type ChatChangesAnswer,
  type ChatCommitInput,
  type ChatPullRequestInput,
  type GitActionKind,
} from '@tracker/shared';
import type { UserScope } from '../../auth/scope';
import type { ChatChangesRow } from '../../db/chatChangeTables';
import { conflict, invalidInput } from '../../errors';
import { findChatChanges } from '../../repositories/chatChanges';
import { insertGitAction, latestGitAction } from '../../repositories/gitActions';
import { latestChatRunRow } from '../../repositories/runs';
import { requireChat } from '../chats';
import type { ServiceContext } from '../context';
import { requireRunner } from '../runners';
import { filesOf, isActive } from './chatChangesRows';
import { notifyGitAction } from './gitActionEvents';
import { readChatChanges } from './readChatChanges';

export const NO_CHAT_CHANGES = 'Claude changed no files in this chat.';
export const CHANGED_SINCE = 'Claude changed more since you looked. Look at the changes again.';

interface Person {
  ctx: ServiceContext;
  scope: UserScope;
}

// Claude may still be changing the files, and one commit at a time keeps git's index its own.
async function requireQuiet({ ctx, scope }: Person, chatId: string, version: string) {
  const changes = await findChatChanges(ctx.db, chatId);
  if (!changes) throw conflict(NO_CHAT_CHANGES);
  if (changes.version !== version) throw conflict(CHANGED_SINCE);
  if (isActive(await latestGitAction(ctx.db, chatId))) {
    throw conflict('The last commit or pull request is still going on.');
  }
  const run = await latestChatRunRow(ctx.db, scope, chatId);
  if (run && (ACTIVE_RUN_STATUSES as readonly string[]).includes(run.status)) {
    throw conflict('Wait until Claude finishes in this chat.');
  }
  await requireRunner(ctx, scope, changes.runnerId);
  return changes;
}

async function queue(
  person: Person,
  chat: { id: string; projectId: string },
  changes: ChatChangesRow,
  action: { kind: GitActionKind; input: object },
): Promise<ChatChangesAnswer> {
  const { ctx, scope } = person;
  const row = {
    id: randomUUID(),
    chatId: chat.id,
    runnerId: changes.runnerId,
    kind: action.kind,
    input: JSON.stringify(action.input),
    status: 'queued' as const,
    error: null,
    result: null,
    createdAt: ctx.now(),
    endedAt: null,
  };
  await insertGitAction(ctx.db, row);
  notifyGitAction(ctx, scope, row, chat.projectId);
  return readChatChanges(ctx, scope, chat.id);
}

// Only files the chat changed, so the person's own work in the folder is never committed unasked.
function requireChatFiles(changes: ChatChangesRow, paths: readonly string[]): void {
  const known = new Set(filesOf(changes).map((file) => file.path));
  if (paths.some((path) => !known.has(path))) {
    throw invalidInput("That file isn't in this chat's changes.");
  }
}

export async function queueCommit(
  ctx: ServiceContext,
  scope: UserScope,
  chatId: string,
  input: ChatCommitInput,
): Promise<ChatChangesAnswer> {
  const person = { ctx, scope };
  const chat = await requireChat(ctx, scope, chatId);
  const changes = await requireQuiet(person, chat.id, input.version);
  requireChatFiles(changes, input.paths);
  const branch = input.branch && input.branch !== changes.branch ? input.branch : null;
  if (branch && isProtectedBranch(branch, changes.defaultBranch)) {
    throw invalidInput(`Pick another name: ${branch} is the main branch.`);
  }
  const paths = [...new Set(input.paths)];
  return queue(person, chat, changes, {
    kind: 'commit',
    input: { message: input.message, paths, branch },
  });
}

export async function queuePullRequest(
  ctx: ServiceContext,
  scope: UserScope,
  chatId: string,
  input: ChatPullRequestInput,
): Promise<ChatChangesAnswer> {
  const person = { ctx, scope };
  const chat = await requireChat(ctx, scope, chatId);
  const changes = await requireQuiet(person, chat.id, input.version);
  if (changes.ghReady !== 1) throw conflict(GH_NOT_SET_UP);
  if (changes.branch === null || isProtectedBranch(changes.branch, changes.defaultBranch)) {
    throw conflict(PROTECTED_BRANCH);
  }
  return queue(person, chat, changes, { kind: 'pull_request', input: { title: input.title } });
}
