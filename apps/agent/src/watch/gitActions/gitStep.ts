import { GIT_ERROR_MAX, maskSecrets } from '@tracker/shared';
import { lastLines } from '../outcome';
import { runTool, type ToolOutput } from '../git/runTool';

// Shown on the phone so the person sees why; the helper's window gets no git output.
export class GitActionError extends Error {}

export interface StepContext {
  cwd: string;
  signal: AbortSignal;
}

const why = ({ err, out }: ToolOutput) => maskSecrets(lastLines(err || out, GIT_ERROR_MAX - 80));

export async function step(
  context: StepContext,
  command: 'git' | 'gh',
  args: readonly string[],
  failed: string,
): Promise<string> {
  const output = await runTool(command, args, context);
  if (output.code === 0) return output.out;
  const detail = why(output);
  throw new GitActionError(detail ? `${failed} ${detail}` : failed);
}
