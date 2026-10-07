import { ApiError } from '@tracker/client';

export class ToolError extends Error {
  override name = 'ToolError';
}

const isFetchFailure = (error: unknown): error is TypeError & { cause: Error } =>
  error instanceof TypeError && error.message === 'fetch failed' && error.cause instanceof Error;

function describeApiError(error: ApiError): string {
  const message = error.message || `The tracker answered with HTTP ${error.status}.`;
  if (error.status !== 401) return message;
  return `${message} Set TRACKER_TOKEN (or --token) to the tracker's access token.`;
}

export function describeError(error: unknown): string {
  if (error instanceof ApiError) return describeApiError(error);
  if (isFetchFailure(error)) {
    return `Could not reach the tracker server (${error.cause.message}). Is it running? Check TRACKER_URL.`;
  }
  return error instanceof Error ? error.message : String(error);
}
