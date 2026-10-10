import { spawn } from 'node:child_process';
import type { ClaudeExit } from './outcome';
import { resultOf, type ClaudeResult } from './stream/claudeResult';
import { createJsonLines } from './stream/jsonLines';

const KEPT_OUTPUT = 20_000;

export const CLAUDE = 'claude';

// One JSON event a line, so the helper sees each step while Claude works and the answer at the
// end; -p prints the steps only with --verbose.
export const STREAM_JSON = ['--output-format', 'stream-json', '--verbose'] as const;

export interface ClaudeCommand {
  command: string;
  args: readonly string[];
  cwd: string;
}

export interface ClaudeListeners {
  onOutput: (text: string) => void;
  onEvent: (event: unknown) => void;
}

export const claudeArgs = (permissionMode?: string): string[] => [
  '-p',
  ...STREAM_JSON,
  ...(permissionMode ? ['--permission-mode', permissionMode] : []),
];

function collect({ onOutput, onEvent }: ClaudeListeners) {
  let output = '';
  const results: ClaudeResult[] = [];
  const say = (text: string) => {
    output = (output + text).slice(-KEPT_OUTPUT);
    onOutput(text);
  };
  const lines = createJsonLines({
    onText: (line) => say(`${line}\n`),
    onEvent: (event) => {
      onEvent(event);
      const found = resultOf(event);
      if (!found) return;
      results.push(found);
      if (found.text) say(`${found.text}\n`);
    },
  });
  return {
    say,
    push: (chunk: string) => lines.push(chunk),
    noteError: (message: string) => {
      output = `${output}\n${message}`;
    },
    exit: (code: number | null, signal: NodeJS.Signals | null): ClaudeExit => {
      lines.end();
      return { code, signal, output, results };
    },
  };
}

// The prompt goes in on stdin, never as an argument, so text from the tracker can't become a flag.
export function runClaude(
  { command, args, cwd }: ClaudeCommand,
  prompt: string,
  signal: AbortSignal,
  listeners: ClaudeListeners,
): Promise<ClaudeExit> {
  return new Promise((resolve) => {
    const seen = collect(listeners);
    let ended = false;
    const end = (code: number | null, exitSignal: NodeJS.Signals | null) => {
      if (!ended) resolve(seen.exit(code, exitSignal));
      ended = true;
    };
    const child = spawn(command, [...args], { cwd, signal, stdio: 'pipe' });
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', seen.push);
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', seen.say);
    child.stdin.on('error', () => undefined);
    child.on('error', (error) => {
      if (error.name === 'AbortError') return;
      seen.noteError(error.message);
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
