import type { AskOptions, RunJob } from '@tracker/shared';
import { STREAM_JSON } from '../claude';
import { askModeArgs } from './askModeArgs';
import { askModelArgs } from './askModelArgs';

const SESSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isSessionId = (value: unknown): value is string =>
  typeof value === 'string' && SESSION_ID.test(value);

// The session id comes from the tracker, so only a UUID becomes an argument.
const resumeArgs = (sessionId: string | null): string[] =>
  isSessionId(sessionId) ? ['--resume', sessionId] : [];

export function askArgs(
  { run, resumeSessionId }: Pick<RunJob, 'run' | 'resumeSessionId'>,
  permissionMode?: string,
): string[] {
  // An older server sends no askOptions at all.
  const options = run.askOptions as Partial<Record<keyof AskOptions, unknown>> | null | undefined;
  return [
    '-p',
    ...STREAM_JSON,
    ...askModeArgs(options?.mode, permissionMode),
    ...askModelArgs(options?.model),
    ...resumeArgs(resumeSessionId),
  ];
}
