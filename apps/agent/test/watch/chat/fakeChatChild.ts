import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import type { ClaudeCommand } from '../../../src/watch/claude';
import type { ChatChild } from '../../../src/watch/chat/chatProcess';

export const SESSION = '11111111-2222-4333-8444-555555555555';

interface Sent {
  uuid: string;
  message: { content: string };
}

// A stand-in for one open claude -p: the test reads what went in on stdin and says what Claude
// prints, as Claude Code 2.1.299 does with CLAUDE_CODE_EMIT_SESSION_STATE_EVENTS and
// --replay-user-messages. An older one (legacy) prints no state and no replay. Like Claude Code,
// it exits once stdin ends.
export class FakeChatChild extends EventEmitter {
  readonly stdin = new PassThrough();
  readonly stdout = new PassThrough();
  readonly stderr = new PassThrough();
  readonly pid = 4242;
  readonly lines: string[] = [];
  exited = false;
  killed = false;

  constructor(
    readonly command: ClaudeCommand,
    readonly legacy = false,
  ) {
    super();
    this.stdin.setEncoding('utf8');
    this.stdin.on('data', (chunk: string) => this.lines.push(...chunk.split('\n').filter(Boolean)));
    this.stdin.on('end', () => this.exit(0, null));
  }

  private sent = (): Sent[] => this.lines.map((line) => JSON.parse(line) as Sent);

  messages = (): string[] => this.sent().map(({ message }) => message.content);

  print(event: object) {
    this.stdout.write(`${JSON.stringify({ session_id: SESSION, ...event })}\n`);
  }

  state(state: 'running' | 'idle') {
    if (!this.legacy) this.print({ type: 'system', subtype: 'session_state_changed', state });
  }

  // The turn of the latest message starts: Claude Code echoes it with its uuid.
  begin() {
    const latest = this.sent().at(-1);
    this.state('running');
    this.print({ type: 'system', subtype: 'init' });
    if (!this.legacy && latest) {
      this.print({ type: 'user', isReplay: true, uuid: latest.uuid, message: latest.message });
    }
  }

  result(text: string, isError = false) {
    this.print({ type: 'result', subtype: 'success', is_error: isError, result: text });
  }

  answer(text: string, isError = false) {
    this.begin();
    this.result(text, isError);
    this.state('idle');
  }

  exit(code: number | null, signal: NodeJS.Signals | null) {
    if (this.exited) return;
    this.exited = true;
    setImmediate(() => this.emit('close', code, signal));
  }

  kill = () => {
    this.killed = true;
    this.exit(null, 'SIGTERM');
    return true;
  };
}

export function fakeSpawn({ legacy = false } = {}) {
  const children: FakeChatChild[] = [];
  const spawn = (command: ClaudeCommand) => {
    const child = new FakeChatChild(command, legacy);
    children.push(child);
    return child as unknown as ChatChild;
  };
  return { spawn, children };
}
