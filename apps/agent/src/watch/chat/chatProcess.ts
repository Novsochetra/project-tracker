import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import type { Run } from '@tracker/shared';
import { isSessionId } from '../ask/askArgs';
import type { ClaudeExit } from '../outcome';
import { createJsonLines } from '../stream/jsonLines';
import { createRunOutput, type ClaudeListeners, type RunOutput } from '../stream/runOutput';
import { CHAT_BUSY } from './chatPool';
import { isIdle, isStateEvent, replayOf } from './turnEvents';
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
  uuid: string;
  output: RunOutput;
  started: boolean;
  results: number;
  done: (exit: ClaudeExit) => void;
}

const sessionOf = (event: unknown): string | undefined => {
  const id = (event as { session_id?: unknown } | null)?.session_id;
  return isSessionId(id) ? id : undefined;
};

// One claude -p a chat, open across its messages: each message is a turn that ends when Claude
// Code goes idle. One too old to say so gets stdin closed at its first result and ends the turn
// by exiting, as before PT-238.
export function startChatProcess(child: ChatChild, onClose: () => void) {
  let turn: OpenTurn | undefined;
  let session: string | undefined;
  let saysState = false;
  let open = true;
  const finish = (ending: Ending) => {
    const ended = turn;
    turn = undefined;
    ended?.done(ended.output.exit(ending));
  };
  const read = (event: unknown, now: OpenTurn) => {
    if (replayOf(event) === now.uuid) now.started = true;
    else if (saysState && !now.started) return;
    else if (isStateEvent(event)) {
      if (isIdle(event) && now.results > 0) finish({ code: null, signal: null, turnEnded: true });
    } else if (now.output.event(event)) {
      now.results += 1;
      if (!saysState) child.stdin.end();
    }
  };
  const lines = createJsonLines({
    onText: (line) => turn?.output.say(`${line}\n`),
    onEvent: (event) => {
      session = sessionOf(event) ?? session;
      saysState ||= isStateEvent(event);
      if (turn) read(event, turn);
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
      const uuid = randomUUID();
      turn = { run, uuid, output: createRunOutput(listeners), started: false, results: 0, done };
      if (stop.aborted) kill();
      else child.stdin.write(userMessageLine(prompt, uuid));
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
