import { spawn } from 'node:child_process';

export interface GitOutput {
  text: string;
  code: number | null;
  // Stopped at maxChars: a diff can be any size, and the helper holds only what it sends.
  cut: boolean;
}

export interface GitOptions {
  maxChars: number;
  // One deadline for every git call of a step, so many calls can't add up.
  signal: AbortSignal;
  env?: Record<string, string>;
}

// Git reads no terminal and starts no pager or editor.
const GIT_ENV = { GIT_TERMINAL_PROMPT: '0', GIT_PAGER: 'cat', GIT_OPTIONAL_LOCKS: '0' };

export function gitOutput(cwd: string, args: readonly string[], options: GitOptions) {
  const { maxChars, signal, env = {} } = options;
  return new Promise<GitOutput>((resolve, reject) => {
    const child = spawn('git', [...args], {
      cwd,
      env: { ...process.env, ...GIT_ENV, ...env },
      stdio: ['ignore', 'pipe', 'ignore'],
      signal,
    });
    let text = '';
    let cut = false;
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      if (cut) return;
      text += chunk;
      if (text.length <= maxChars) return;
      text = text.slice(0, maxChars);
      cut = true;
      child.kill();
    });
    child.on('error', reject);
    child.on('close', (code) => resolve({ text, code: cut ? 0 : code, cut }));
  });
}
