import { withSentFiles, type RunJob } from '@tracker/shared';
import { askChoiceArgs } from '../ask/askArgs';
import { withAskFiles, type FetchFile } from '../ask/askFiles';
import type { ClaudeExit } from '../outcome';
import { createChatPool, type ChatPoolOptions } from './chatPool';
import { openChat, type ChatSetup, type OpenChat } from './openChat';

export interface ChatRunnerSetup extends ChatSetup {
  fetchFile?: FetchFile | undefined;
  pool?: ChatPoolOptions | undefined;
}

type OnEvent = (event: unknown) => void;

// Chat questions only: a ticket run still gets a claude of its own that ends with the run.
export function createChatRunner(setup: ChatRunnerSetup) {
  const chats = createChatPool<OpenChat>(setup.pool);
  const ask = (job: RunJob, stop: AbortSignal, onEvent: OnEvent): Promise<ClaudeExit> =>
    chats.use(
      {
        // An ask always has its chat; a run without one gets a process of its own.
        chatId: job.run.chatId ?? job.run.id,
        key: askChoiceArgs(job.run, setup.permissionMode).join('\n'),
        resume: job.resumeSessionId,
        start: (onClose) => openChat(setup, job, onClose),
      },
      (chat) =>
        withAskFiles(setup.fetchFile, { job, stop, root: chat.folder }, (folder) =>
          chat.send({
            run: job.run,
            prompt: withSentFiles(job.prompt, folder?.paths ?? []),
            stop,
            listeners: { onOutput: () => undefined, onEvent },
          }),
        ),
    );
  return { ask, closeAll: chats.closeAll };
}
