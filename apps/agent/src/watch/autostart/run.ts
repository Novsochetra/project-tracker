import { execFileSync } from 'node:child_process';

// Throws with the command's stderr on a non-zero exit, so a test can stand in for any command.
export type Run = (command: string, args: readonly string[]) => string;

export const runCommand: Run = (command, args) =>
  execFileSync(command, [...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

export const failureOf = (error: unknown): string => {
  const failed = error as { stderr?: string; message?: string };
  return (failed.stderr || failed.message || '').trim();
};
