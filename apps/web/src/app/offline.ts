import { ApiError } from '@tracker/client';
import { isNetworkError } from '../api';

export type ApiSignal = 'reachable' | 'unreachable';

export interface CacheAction {
  type: string;
  error?: unknown;
  manual?: boolean;
}

// An error the server answered with still proves it can be reached.
function signalOfError(error: unknown): ApiSignal | null {
  if (isNetworkError(error)) return 'unreachable';
  return error instanceof ApiError ? 'reachable' : null;
}

// setQueryData reports a success too; only answers to a request say anything about the server.
// The service worker answers a read from its cache only when the network failed or was too slow.
export function signalOf(action: CacheAction, fromCache = false): ApiSignal | null {
  if (action.type === 'error') return signalOfError(action.error);
  if (action.type !== 'success' || action.manual) return null;
  return fromCache ? 'unreachable' : 'reachable';
}
