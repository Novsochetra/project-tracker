import { ApiError } from '@tracker/client';
import { isNetworkError } from '../api';

// 'unsure': a bare 5xx. A proxy answers that way for a stopped API, but so can the API itself, or a
// proxy whose connection to it broke during one request, so the tracker is checked first.
// A read the service worker answered from its saved copy got no answer from the network: a check or
// a write may still get one (PT-126).
export type ApiSignal = 'reachable' | 'unreachable' | 'unsure' | 'saved';

export interface CacheAction {
  type: string;
  error?: unknown;
  manual?: boolean;
}

// An error the server answered with still proves it can be reached.
export function signalOfError(error: unknown): ApiSignal | null {
  if (isNetworkError(error)) return error instanceof ApiError ? 'unsure' : 'unreachable';
  return error instanceof ApiError ? 'reachable' : null;
}

// setQueryData reports a success too; only answers to a request say anything about the server.
// The service worker answers a read from its cache only when the network failed or was too slow.
export function signalOf(action: CacheAction, fromCache = false): ApiSignal | null {
  if (action.type === 'error') return signalOfError(action.error);
  if (action.type !== 'success' || action.manual) return null;
  return fromCache ? 'saved' : 'reachable';
}
