import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { changesFolder, type RunJob } from '@tracker/shared';
import { askArgs } from '../ask/askArgs';
import { ASK_FOLDER_PREFIX } from '../ask/askFiles';
import type { ClaudeCommand } from '../claude';
import { claudeEnv } from '../claudeEnv';
import { runPermissions } from '../permissionTool/runPermissions';
import { openPromptTool, type PromptTool } from '../permissionTool/withPromptTool';
import { startChatProcess, type ChatChild, type ChatProcess } from './chatProcess';
import { STATE_EVENTS_ENV } from './turnEvents';

export type SpawnChat = (command: ClaudeCommand) => ChatChild;

export interface ChatSetup {
  command: string;
  cwd: string;
  permissionMode?: string | undefined;
  limit: readonly string[];
  prompts?: PromptTool | undefined;
  spawn?: SpawnChat | undefined;
}

export type OpenChat = ChatProcess & { folder: string; reusable: () => boolean };

const spawnClaude: SpawnChat = ({ command, args, cwd }) =>
  spawn(command, [...args], {
    cwd,
    stdio: 'pipe',
    env: { ...claudeEnv(process.env), ...STATE_EVENTS_ENV },
  });

// Claude Code's file tools reach only the folders it was started with, so the process gets one
// folder of its own and each question's files go in it (withAskFiles).
export async function openChat(
  setup: ChatSetup,
  job: RunJob,
  onClose: () => void,
): Promise<OpenChat> {
  const { allowed, tool } = runPermissions(job.run, setup.prompts);
  const live: { chat?: ChatProcess } = {};
  const prompt = tool ? await openPromptTool(tool, () => live.chat?.runNow()) : undefined;
  const cleanUp = (folder?: string) => {
    prompt?.close();
    if (folder) void rm(folder, { recursive: true, force: true });
  };
  const folder = await mkdtemp(join(tmpdir(), ASK_FOLDER_PREFIX)).catch((error: unknown) => {
    cleanUp();
    throw error;
  });
  const args = [
    ...askArgs(job, setup.permissionMode),
    ...setup.limit,
    ...allowed,
    ...(prompt?.args ?? []),
    '--add-dir',
    folder,
  ];
  const child = (setup.spawn ?? spawnClaude)({ command: setup.command, cwd: setup.cwd, args });
  const chat = startChatProcess(child, () => {
    cleanUp(folder);
    onClose();
  });
  live.chat = chat;
  // A background shell still running may start a turn after idle that nobody watches; in a chat
  // that changes the folder it could do so while a ticket run holds the lane. The next resumes.
  const leavesWork = () => changesFolder(job.run.askOptions?.mode) && chat.tasksRunning() > 0;
  return { ...chat, folder, reusable: () => !leavesWork() };
}
