export interface ClaudeResult {
  text: string;
  sessionId: string | undefined;
  isError: boolean;
}

const isObject = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null;

// A failed run's result has no text, only its errors.
function textOf(event: Readonly<Record<string, unknown>>): string {
  if (typeof event.result === 'string') return event.result;
  const errors = Array.isArray(event.errors) ? event.errors : [];
  return errors.filter((error): error is string => typeof error === 'string').join('\n');
}

export function resultOf(event: unknown): ClaudeResult | null {
  if (!isObject(event) || event.type !== 'result') return null;
  return {
    text: textOf(event).trim(),
    sessionId: typeof event.session_id === 'string' ? event.session_id : undefined,
    isError: event.is_error === true,
  };
}
