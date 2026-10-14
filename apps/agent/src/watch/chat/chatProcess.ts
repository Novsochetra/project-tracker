import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import type { Run } from '@tracker/shared';
import { isSessionId } from '../ask/askArgs';
import type { ClaudeExit } from '../outcome';
import { createJsonLines } from '../stream/jsonLines';
import { createRunOutput, type ClaudeListeners, type RunOutput } from '../stream/runOutput';
import { CHAT_BUSY } from './chatPool';
import { userMessageLine } from './userMessage';

export type ChatChild = Pick<
  ChildProcessWithoutNullStreams,
  'stdin' | 'stdout' | 'stderr' | 'pid' | 'kill' | 'on'
>;

export interface ChatTurn {
  run: Run;
  prompt: string;
  stop: AbortSignal;
  listeners: ClaudeListeners;
}

export const CHAT_CLOSED = 'Claude Code closed before the message reached it.';

// Claude Code saves the session as stdin ends; one that hangs past this is killed.
const CLOSE_GRACE_MS = 10_000;

type Ending = Pick<ClaudeExit, 'code' | 'signal' | 'turnEnded'>;

interface OpenTurn {
  run: Run;
  output: RunOutput;
  done: (exit: ClaudeExit) => void;
}

const sessionOf = (event: unknown): string | undefined => {
  const id = (event as { session_id?: unknown } | null)?.session_id;
  return isSessionId(id) ? id : undefined;
};

// One claude -p a chat, open across its messages: each message is a turn that ends on its result.
export function startChatProcess(child: ChatChild, onClose: () => void) {
  let turn: OpenTurn | undefined;
  let session: string | undefined;
  let open = true;
  const finish = (ending: Ending) => {
    const ended = turn;
    turn = undefined;
    ended?.done(ended.output.exit(ending));
  };
  const lines = createJsonLines({
    onText: (line) => turn?.output.say(`${line}\n`),
    onEvent: (event) => {
      session = sessionOf(event) ?? session;
      if (turn?.output.event(event)) finish({ code: null, signal: null, turnEnded: true });
    },
  });
  const closed = (code: number | null, signal: NodeJS.Signals | null) => {
    if (!open) return;
    open = false;
    lines.end();
    finish({ code, signal });
    onClose();
  };
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk: string) => lines.push(chunk));
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (text: string) => turn?.output.say(text));
  child.stdin.on('error', () => undefined);
  child.on('error', (error) => {
    turn?.output.noteError(error.message);
    if (child.pid === undefined) closed(null, null);
  });
  child.on('close', closed);
  const kill = () => {
    if (open) child.kill();
  };

  function send({ run, prompt, stop, listeners }: ChatTurn): Promise<ClaudeExit> {
    if (!open) return Promise.reject(new Error(CHAT_CLOSED));
    if (turn) return Promise.reject(new Error(CHAT_BUSY));
    return new Promise((resolve) => {
      stop.addEventListener('abort', kill, { once: true });
      const done = (exit: ClaudeExit) => {
        stop.removeEventListener('abort', kill);
        resolve(exit);
      };
      turn = { run, output: createRunOutput(listeners), done };
      if (stop.aborted) kill();
      else child.stdin.write(userMessageLine(prompt));
    });
  }

  return {
    send,
    sessionId: () => session,
    runNow: () => turn?.run,
    close: () => {
      if (open) child.stdin.end();
      setTimeout(kill, CLOSE_GRACE_MS).unref();
    },
  };
}

export type ChatProcess = ReturnType<typeof startChatProcess>;
