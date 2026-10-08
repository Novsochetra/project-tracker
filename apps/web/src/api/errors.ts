import { ApiError } from '@tracker/client';

export const NETWORK_ERROR_MESSAGE = "Can't reach the tracker. Check your connection.";
export const FALLBACK_ERROR_MESSAGE = 'Something went wrong. Try again.';

// A dev proxy answers with a bare 5xx (no JSON error body) while the API server is down.
const PROXY_FAILURE_STATUSES = new Set([500, 502, 503, 504]);

export const isApiError = (error: unknown): error is ApiError => error instanceof ApiError;

const hasStatus = (error: unknown, status: number): boolean =>
  isApiError(error) && error.status === status;

export const isUnauthorized = (error: unknown): boolean => hasStatus(error, 401);

export const isNotFound = (error: unknown): boolean => hasStatus(error, 404);

export const isClientError = (error: unknown): boolean =>
  isApiError(error) && error.status >= 400 && error.status < 500;

const isOffline = (): boolean => typeof navigator !== 'undefined' && navigator.onLine === false;

export const isNetworkError = (error: unknown): boolean =>
  isApiError(error)
    ? error.code === 'http_error' && PROXY_FAILURE_STATUSES.has(error.status)
    : error instanceof TypeError || isOffline();

export function errorMessage(error: unknown): string {
  if (isNetworkError(error)) return NETWORK_ERROR_MESSAGE;
  if (isApiError(error) && error.message) return error.message;
  return FALLBACK_ERROR_MESSAGE;
}
