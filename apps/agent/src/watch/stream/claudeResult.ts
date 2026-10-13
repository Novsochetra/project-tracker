import { isJson, type Json } from '@tracker/shared';
import { readTokensOf } from './readTokens';

// Claude Code's own figures on a result. The turns and time are this turn's; the cost and the
// tokens are the session's so far, which on --resume can include earlier runs' (runUsage).
export interface ResultUsage {
  costUsd: number | undefined;
  turns: number | undefined;
  durationMs: number | undefined;
  readTokens: number | undefined;
}

export interface ClaudeResult {
  text: string;
  sessionId: string | undefined;
  isError: boolean;
  usage?: ResultUsage;
}

const numberOf = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;

// A failed run's result has no text, only its errors.
function textOf(event: Json): string {
  if (typeof event.result === 'string') return event.result;
  const errors = Array.isArray(event.errors) ? event.errors : [];
  return errors.filter((error): error is string => typeof error === 'string').join('\n');
}

// modelUsage has a line per model, the sub agents' too.
function sessionReadTokens(modelUsage: unknown): number | undefined {
  if (!isJson(modelUsage)) return undefined;
  const models = Object.values(modelUsage).filter(isJson);
  if (models.length === 0) return undefined;
  return models.reduce(
    (total, model) =>
      total +
      readTokensOf(model.inputTokens, model.cacheReadInputTokens, model.cacheCreationInputTokens),
    0,
  );
}

const usageOf = (event: Json): ResultUsage => ({
  costUsd: numberOf(event.total_cost_usd),
  turns: numberOf(event.num_turns),
  durationMs: numberOf(event.duration_ms),
  readTokens: sessionReadTokens(event.modelUsage),
});

export function resultOf(event: unknown): ClaudeResult | null {
  if (!isJson(event) || event.type !== 'result') return null;
  return {
    text: textOf(event).trim(),
    sessionId: typeof event.session_id === 'string' ? event.session_id : undefined,
    isError: event.is_error === true,
    usage: usageOf(event),
  };
}

// The last turn's result is how the run ended, as `--output-format json` prints only it: an
// earlier one is Claude saying it started background work, or a failure it went on from.
export const finalResult = (results: readonly ClaudeResult[]): ClaudeResult | undefined =>
  results.at(-1);
