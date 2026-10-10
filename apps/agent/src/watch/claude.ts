import { spawn } from 'node:child_process';
import type { ClaudeExit } from './outcome';

const KEPT_OUTPUT = 20_000;

export interface ClaudeCommand {
  command: string;
  permissionMode?: string | undefined;
  cwd: string;
}

export const claudeArgs = (permissionMode?: string): string[] =>
  permissionMode ? ['-p', '--permission-mode', permissionMode] : ['-p'];

// The prompt goes in on stdin, never as an argument, so text from the tracker can't become a flag.
export function runClaude(
  { command, permissionMode, cwd }: ClaudeCommand,
  prompt: string,
  signal: AbortSignal,
  onOutput: (text: string) => void,
): Promise<ClaudeExit> {
  return new Promise((resolve) => {
    let output = '';
    let ended = false;
    const end = (code: number | null, exitSignal: NodeJS.Signals | null) => {
      if (!ended) resolve({ code, signal: exitSignal, output });
      ended = true;
    };
    const child = spawn(command, claudeArgs(permissionMode), { cwd, signal, stdio: 'pipe' });
    const keep = (chunk: Buffer) => {
      output = (output + chunk.toString()).slice(-KEPT_OUTPUT);
      onOutput(chunk.toString());
    };
    child.stdout.on('data', keep);
    child.stderr.on('data', keep);
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
