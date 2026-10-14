import { spawn } from 'node:child_process';

export interface ToolOutput {
  code: number | null;
  out: string;
  // Its last part only: a hook can print a lot, and only the end says why it failed.
  err: string;
}

export interface ToolOptions {
  cwd: string;
  signal: AbortSignal;
  env?: Record<string, string>;
  // Written to its stdin, as git's --index-info reads.
  input?: string;
  // For output the caller must have whole, as index entries.
  outMax?: number;
  // Tests only.
  killGraceMs?: number;
}

const OUT_MAX = 20_000;
const ERR_MAX = 8_000;
// Git cleans up its index.lock on SIGTERM; SIGKILL, which can't be caught, leaves it behind.
const KILL_GRACE_MS = 5_000;

// git and gh read no terminal, start no pager, editor or prompt, and print no colors.
const QUIET_ENV = {
  GIT_TERMINAL_PROMPT: '0',
  GIT_PAGER: 'cat',
  GIT_EDITOR: 'true',
  GIT_LITERAL_PATHSPECS: '1',
  GH_PROMPT_DISABLED: '1',
  GH_NO_UPDATE_NOTIFIER: '1',
  NO_COLOR: '1',
};

const keepEnd = (text: string, max: number) => (text.length > max ? text.slice(-max) : text);

// A group of its own, so a deadline stops the hooks and helpers git starts too.
function signalGroup(pid: number | undefined, signal: NodeJS.Signals) {
  try {
    if (pid !== undefined) process.kill(-pid, signal);
  } catch {
    // It ended already.
  }
}

// Arguments go to the program as they are, with no shell, so a branch name or a message can't
// run anything. A program that isn't installed rejects; one stopped at its deadline rejects once
// it has exited, so what runs next finds no lock of its.
export function runTool(command: string, args: readonly string[], options: ToolOptions) {
  return new Promise<ToolOutput>((resolve, reject) => {
    if (options.signal.aborted) return reject(new Error('Stopped before it started.'));
    const child = spawn(command, [...args], {
      cwd: options.cwd,
      env: { ...process.env, ...QUIET_ENV, ...options.env },
      stdio: 'pipe',
      detached: true,
    });
    let stopped = false;
    let force: NodeJS.Timeout | undefined;
    const stop = () => {
      stopped = true;
      signalGroup(child.pid, 'SIGTERM');
      force = setTimeout(
        () => signalGroup(child.pid, 'SIGKILL'),
        options.killGraceMs ?? KILL_GRACE_MS,
      );
    };
    options.signal.addEventListener('abort', stop, { once: true });
    let out = '';
    let err = '';
    child.stdin.on('error', () => undefined);
    child.stdin.end(options.input ?? '');
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      out = (out + chunk).slice(0, options.outMax ?? OUT_MAX);
    });
    child.stderr.on('data', (chunk: string) => {
      err = keepEnd(err + chunk, ERR_MAX);
    });
    child.on('error', reject);
    child.on('close', (code) => {
      clearTimeout(force);
      options.signal.removeEventListener('abort', stop);
      if (stopped) reject(new Error('Stopped at its deadline.'));
      else resolve({ code, out, err });
    });
  });
}
