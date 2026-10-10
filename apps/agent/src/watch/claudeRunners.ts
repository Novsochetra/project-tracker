import type { RunJob } from '@tracker/shared';
import { askArgs } from './ask/askArgs';
import { claudeArgs, runClaude } from './claude';

export interface ClaudeSetup {
  command: string;
  cwd: string;
  permissionMode?: string | undefined;
  write: (text: string) => void;
}

// The person's --permission-mode reaches ticket runs only; an ask always gets the read-only flags.
export function claudeRunners({ command, cwd, permissionMode, write }: ClaudeSetup) {
  const ticket = { command, cwd, args: claudeArgs(permissionMode) };
  return {
    runClaude: (prompt: string, stop: AbortSignal) => runClaude(ticket, prompt, stop, write),
    // An answer is one JSON object for the tracker, not text for this window.
    runAsk: (job: RunJob, stop: AbortSignal) =>
      runClaude(
        { command, cwd, args: askArgs(job.resumeSessionId) },
        job.prompt,
        stop,
        () => undefined,
      ),
  };
}
