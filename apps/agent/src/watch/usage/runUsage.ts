import { runUsageInput, type RunJob, type RunUsageInput } from '@tracker/shared';
import { isSessionId } from '../ask/askArgs';
import type { ClaudeExit } from '../outcome';
import { finalResult, type ResultUsage } from '../stream/claudeResult';
import { ownCostUsd } from './ownCost';
import type { SessionMarks } from './sessionMarks';

const MICROS = 1_000_000;

type Field = keyof RunUsageInput;

// Background work gets a turn of its own, each with its own turns and time.
function sumOf(usages: readonly ResultUsage[], key: 'turns' | 'durationMs'): number | undefined {
  const values = usages.flatMap((usage) => (usage[key] === undefined ? [] : [usage[key]]));
  return values.length === 0 ? undefined : values.reduce((total, value) => total + value, 0);
}

// A figure the tracker would refuse is dropped, not the run's end with it.
const fitting = (key: Field, value: number | undefined) =>
  value !== undefined && runUsageInput.shape[key].safeParse(value).success ? { [key]: value } : {};

export function runUsageOf(
  job: RunJob,
  exit: ClaudeExit,
  sessions: SessionMarks,
): RunUsageInput | undefined {
  const final = finalResult(exit.results);
  if (!final?.usage) return undefined;
  const usages = exit.results.flatMap((result) => (result.usage ? [result.usage] : []));
  const costUsd = ownCostUsd({
    final: final.usage,
    readTokens: exit.readTokens ?? 0,
    resumed: isSessionId(job.resumeSessionId),
    before: final.sessionId ? sessions.get(final.sessionId) : undefined,
  });
  sessions.note(final.sessionId, final.usage);
  const usage = {
    ...fitting('costMicros', costUsd === undefined ? undefined : Math.round(costUsd * MICROS)),
    ...fitting('turns', sumOf(usages, 'turns')),
    ...fitting('durationMs', sumOf(usages, 'durationMs')),
  };
  return Object.keys(usage).length > 0 ? usage : undefined;
}
