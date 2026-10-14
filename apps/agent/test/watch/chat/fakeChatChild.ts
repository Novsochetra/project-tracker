import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import type { ClaudeCommand } from '../../../src/watch/claude';
import type { ChatChild } from '../../../src/watch/chat/chatProcess';

export const SESSION = '11111111-2222-4333-8444-555555555555';

// A stand-in for one open claude -p: the test reads what went in on stdin and says what Claude
// prints. Like Claude Code, it exits once stdin ends.
export class FakeChatChild extends EventEmitter {
  readonly stdin = new PassThrough();
  readonly stdout = new PassThrough();
  readonly stderr = new PassThrough();
  readonly pid = 4242;
  readonly lines: string[] = [];
  exited = false;
  killed = false;

  constructor(readonly command: ClaudeCommand) {
    super();
    this.stdin.setEncoding('utf8');
    this.stdin.on('data', (chunk: string) => this.lines.push(...chunk.split('\n').filter(Boolean)));
    this.stdin.on('end', () => this.exit(0, null));
  }

  messages = (): string[] =>
    this.lines.map(
      (line) => (JSON.parse(line) as { message: { content: string } }).message.content,
    );

  print(event: object) {
    this.stdout.write(`${JSON.stringify({ session_id: SESSION, ...event })}\n`);
  }

  answer(text: string, isError = false) {
    this.print({ type: 'system', subtype: 'init' });
    this.print({ type: 'result', subtype: 'success', is_error: isError, result: text });
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

export function fakeSpawn() {
  const children: FakeChatChild[] = [];
  const spawn = (command: ClaudeCommand) => {
    const child = new FakeChatChild(command);
    children.push(child);
    return child as unknown as ChatChild;
  };
  return { spawn, children };
}
