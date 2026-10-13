import { isJson, type Json } from '@tracker/shared';

export interface ClaudeResult {
  text: string;
  sessionId: string | undefined;
  isError: boolean;
}

// A failed run's result has no text, only its errors.
function textOf(event: Json): string {
  if (typeof event.result === 'string') return event.result;
  const errors = Array.isArray(event.errors) ? event.errors : [];
  return errors.filter((error): error is string => typeof error === 'string').join('\n');
}

export function resultOf(event: unknown): ClaudeResult | null {
  if (!isJson(event) || event.type !== 'result') return null;
  return {
    text: textOf(event).trim(),
    sessionId: typeof event.session_id === 'string' ? event.session_id : undefined,
    isError: event.is_error === true,
  };
}

// The last turn's result is how the run ended, as `--output-format json` prints only it: an
// earlier one is Claude saying it started background work, or a failure it went on from.
export const finalResult = (results: readonly ClaudeResult[]): ClaudeResult | undefined =>
  results.at(-1);
