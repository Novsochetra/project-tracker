import { spawn } from 'node:child_process';
import type { ClaudeExit } from './outcome';

const KEPT_OUTPUT = 20_000;
// An ask's whole answer comes on stdout as one JSON object, so stdout is kept apart and in full.
const KEPT_STDOUT = 2_000_000;

export const CLAUDE = 'claude';

export interface ClaudeCommand {
  command: string;
  args: readonly string[];
  cwd: string;
}

export const claudeArgs = (permissionMode?: string): string[] =>
  permissionMode ? ['-p', '--permission-mode', permissionMode] : ['-p'];

// The prompt goes in on stdin, never as an argument, so text from the tracker can't become a flag.
export function runClaude(
  { command, args, cwd }: ClaudeCommand,
  prompt: string,
  signal: AbortSignal,
  onOutput: (text: string) => void,
): Promise<ClaudeExit> {
  return new Promise((resolve) => {
    let output = '';
    let stdout = '';
    let ended = false;
    const end = (code: number | null, exitSignal: NodeJS.Signals | null) => {
      if (!ended) resolve({ code, signal: exitSignal, output, stdout });
      ended = true;
    };
    const child = spawn(command, [...args], { cwd, signal, stdio: 'pipe' });
    const keep = (text: string) => {
      output = (output + text).slice(-KEPT_OUTPUT);
      onOutput(text);
    };
    for (const stream of [child.stdout, child.stderr]) {
      stream.setEncoding('utf8');
      stream.on('data', keep);
    }
    child.stdout.on('data', (text: string) => {
      if (stdout.length < KEPT_STDOUT) stdout += text;
    });
    child.stdin.on('error', () => undefined);
    child.on('error', (error) => {
      if (error.name === 'AbortError') return;
      output = `${output}\n${error.message}`;
      if (child.pid === undefined) end(null, null);
    });
    child.on('close', end);
    child.stdin.end(prompt);
  });
}

export function claudeIsInstalled(command: string): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn(command, ['--version'], { stdio: 'ignore' });
    child.on('error', () => resolve(false));
    child.on('close', (code) => resolve(code === 0));
  });
}
