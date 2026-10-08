import { ApiError } from '@tracker/client';
import { errorMessage, NETWORK_ERROR_MESSAGE } from '../api';

export type ApiSignal = 'reachable' | 'unreachable';

export interface CacheAction {
  type: string;
  error?: unknown;
  manual?: boolean;
}

const isNetworkFailure = (error: unknown): boolean => errorMessage(error) === NETWORK_ERROR_MESSAGE;

// An error the server answered with still proves it can be reached.
function signalOfError(error: unknown): ApiSignal | null {
  if (isNetworkFailure(error)) return 'unreachable';
  return error instanceof ApiError ? 'reachable' : null;
}

// setQueryData reports a success too; only answers to a request say anything about the server.
export function signalOf(action: CacheAction): ApiSignal | null {
  if (action.type === 'success') return action.manual ? null : 'reachable';
  return action.type === 'error' ? signalOfError(action.error) : null;
}
