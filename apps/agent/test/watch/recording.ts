import { fileURLToPath } from 'node:url';
import { runClaude } from '../../src/watch/claude';
import type { ClaudeExit } from '../../src/watch/outcome';

// Real runs of Claude Code 2.1.296, recorded in shared for the step reader's tests too.
export const recording = (name: string) =>
  fileURLToPath(
    new URL(`../../../../packages/shared/test/fixtures/stream-json/${name}.jsonl`, import.meta.url),
  );

export const replayCommand = (name: string, code: number) => ({
  command: '/bin/sh',
  args: ['-c', 'cat "$0"; exit "$1"', recording(name), `${code}`],
  cwd: '/',
});

export const replayed = (name: string, code = 0): Promise<ClaudeExit> =>
  runClaude(replayCommand(name, code), 'go', new AbortController().signal, {
    onOutput: () => undefined,
    onEvent: () => undefined,
  });
