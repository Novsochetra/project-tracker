import { modelTakesEffort, type AskOptions, type RunJob } from '@tracker/shared';
import { STREAM_JSON } from '../claude';
import { askEffortArgs } from './askEffortArgs';
import { askModeArgs } from './askModeArgs';
import { askModelArgs } from './askModelArgs';

const SESSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// A chat's Claude stays open and reads each message as a JSON line on stdin (PT-238). It echoes
// each message, with its uuid, as the message's turn starts, so output from background work of an
// earlier turn is never taken for this one (chatProcess).
const STREAM_INPUT = ['--input-format', 'stream-json', '--replay-user-messages'] as const;

export const isSessionId = (value: unknown): value is string =>
  typeof value === 'string' && SESSION_ID.test(value);

// The session id comes from the tracker, so only a UUID becomes an argument.
const resumeArgs = (sessionId: string | null): string[] =>
  isSessionId(sessionId) ? ['--resume', sessionId] : [];

export function askChoiceArgs(run: RunJob['run'], permissionMode?: string): string[] {
  // An older server sends no askOptions at all.
  const options = run.askOptions as Partial<Record<keyof AskOptions, unknown>> | null | undefined;
  return [
    ...askModeArgs(options?.mode, permissionMode),
    ...askModelArgs(options?.model),
    ...(modelTakesEffort(options?.model) ? askEffortArgs(options?.effort) : []),
  ];
}

export function askArgs(
  { run, resumeSessionId }: Pick<RunJob, 'run' | 'resumeSessionId'>,
  permissionMode?: string,
): string[] {
  return [
    '-p',
    ...STREAM_INPUT,
    ...STREAM_JSON,
    ...askChoiceArgs(run, permissionMode),
    ...resumeArgs(resumeSessionId),
  ];
}
