import { spawn } from 'node:child_process';
import { lastLines, type ClaudeExit } from './outcome';

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
  return new Promise((done) => {
    let output = '';
    const child = spawn(command, claudeArgs(permissionMode), { cwd, signal, stdio: 'pipe' });
    const keep = (chunk: Buffer) => {
      const text = chunk.toString();
      output = lastLines(output + text, KEPT_OUTPUT);
      onOutput(text);
    };
    child.stdout.on('data', keep);
    child.stderr.on('data', keep);
    child.stdin.on('error', () => undefined);
    child.on('error', (error) => {
      if (error.name !== 'AbortError') output = lastLines(`${output}\n${error.message}`);
    });
    child.on('close', (code) => done({ code, output }));
    child.stdin.end(prompt);
  });
}

export function claudeIsInstalled(command: string): Promise<boolean> {
  return new Promise((done) => {
    const child = spawn(command, ['--version'], { stdio: 'ignore' });
    child.on('error', () => done(false));
    child.on('close', (code) => done(code === 0));
  });
}
