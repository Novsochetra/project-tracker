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
}

const OUT_MAX = 20_000;
const ERR_MAX = 8_000;

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

// Arguments go to the program as they are, with no shell, so a branch name or a message can't
// run anything. A program that isn't installed rejects.
export function runTool(command: string, args: readonly string[], options: ToolOptions) {
  return new Promise<ToolOutput>((resolve, reject) => {
    const child = spawn(command, [...args], {
      cwd: options.cwd,
      env: { ...process.env, ...QUIET_ENV, ...options.env },
      stdio: ['ignore', 'pipe', 'pipe'],
      signal: options.signal,
    });
    let out = '';
    let err = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      out = (out + chunk).slice(0, OUT_MAX);
    });
    child.stderr.on('data', (chunk: string) => {
      err = keepEnd(err + chunk, ERR_MAX);
    });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, out, err }));
  });
}
