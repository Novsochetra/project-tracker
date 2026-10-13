import { spawn } from 'node:child_process';

export const LIST_TIMEOUT_MS = 60_000;

// `claude mcp list` starts every server to see whether it answers, which is the check we want.
// stdin is /dev/null so it never waits for input, and a bad exit code still leaves its lines.
// The helper's stop signal ends it, or a stopped helper would wait up to a minute for the list.
export function mcpListOutput(
  command: string,
  cwd: string,
  signal: AbortSignal,
  timeoutMs = LIST_TIMEOUT_MS,
): Promise<string> {
  return new Promise((resolve) => {
    let output = '';
    const child = spawn(command, ['mcp', 'list'], {
      cwd,
      signal,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const timer = setTimeout(() => child.kill(), timeoutMs);
    for (const stream of [child.stdout, child.stderr]) {
      stream.setEncoding('utf8');
      stream.on('data', (text: string) => {
        output += text;
      });
    }
    const end = () => {
      clearTimeout(timer);
      resolve(output);
    };
    child.on('error', end);
    child.on('close', end);
  });
}
