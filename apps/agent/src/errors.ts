import { ApiError } from '@tracker/client';
import type { TokenSource } from './config';

export class ToolError extends Error {
  override name = 'ToolError';
}

export interface Connection {
  trackerUrl?: string | undefined;
  tokenSource?: TokenSource | undefined;
}

const TOKEN_HELP = 'Create one in the app: Connect Claude Code → API tokens.';
const CHECK_URL = "Check that TRACKER_URL (or --url) is the tracker's address.";

const isFetchFailure = (error: unknown): error is TypeError & { cause: Error } =>
  error instanceof TypeError && error.message === 'fetch failed' && error.cause instanceof Error;

// Node's fetch tries each address of localhost and fails with an AggregateError without a message.
function causeText(cause: Error): string {
  const nested = cause instanceof AggregateError ? (cause.errors[0] as unknown) : undefined;
  const text = cause.message || (nested instanceof Error ? nested.message : '');
  return text ? ` (${text})` : '';
}

const tracker = ({ trackerUrl }: Connection): string =>
  trackerUrl ? `the tracker at ${trackerUrl}` : 'the tracker';

const subject = (connection: Connection): string => `T${tracker(connection).slice(1)}`;

const loginCommand = ({ trackerUrl }: Connection): string =>
  trackerUrl ? `tracker login --url ${trackerUrl}` : 'tracker login';

const SOURCE_NAMES: Record<TokenSource, string> = {
  '--token': 'the token from --token',
  TRACKER_API_TOKEN: 'the token in TRACKER_API_TOKEN',
  TRACKER_TOKEN: 'the token in TRACKER_TOKEN',
  'tracker login': 'the token saved by tracker login',
};

// The new token has to go where the refused one came from, or that one keeps winning.
function replaceAdvice(source: TokenSource, login: string): string {
  if (source === 'tracker login') return `Then run "${login}" and paste the new one.`;
  if (source === '--token') return 'Then pass the new one.';
  return `Then set ${source} to the new one, or unset it and run "${login}".`;
}

// The server's own 401 text is written for the sign-in screen; an agent needs to know about tokens.
function unauthorizedText(connection: Connection): string {
  const { tokenSource } = connection;
  const login = loginCommand(connection);
  if (!tokenSource) {
    return `${subject(connection)} needs an API token. ${TOKEN_HELP} Then run "${login}" and paste it, or set TRACKER_API_TOKEN.`;
  }
  const refused = `${subject(connection)} refused ${SOURCE_NAMES[tokenSource]}: it was revoked, mistyped or made for another tracker.`;
  return `${refused} ${TOKEN_HELP} ${replaceAdvice(tokenSource, login)}`;
}

function rateLimitedText(error: ApiError, connection: Connection): string {
  const told = error.code === 'http_error' ? '' : ` ${error.message}`;
  const advice = /try again/i.test(told) ? '' : ' Wait a minute, then try again.';
  return `${subject(connection)} is getting too many requests (HTTP 429).${told}${advice}`;
}

// An answer without the tracker's JSON error came from something else at that address: a proxy,
// a host that is restarting, or the wrong URL.
function bareAnswerText(error: ApiError, connection: Connection): string {
  const answered = `${subject(connection)} answered HTTP ${error.status}${error.message ? ` ${error.message}` : ''}.`;
  return error.status >= 500
    ? `${answered} It may be restarting: try again in a minute.`
    : `${answered} ${CHECK_URL}`;
}

function describeApiError(error: ApiError, connection: Connection): string {
  if (error.status === 401) return unauthorizedText(connection);
  if (error.status === 429) return rateLimitedText(error, connection);
  if (error.code === 'http_error') return bareAnswerText(error, connection);
  return error.message || `${subject(connection)} answered HTTP ${error.status}.`;
}

export function describeError(error: unknown, connection: Connection = {}): string {
  if (error instanceof ApiError) return describeApiError(error, connection);
  if (isFetchFailure(error)) {
    return `Could not reach ${tracker(connection)}${causeText(error.cause)}. Is it running? Check TRACKER_URL (or --url).`;
  }
  // The client parses every answer as JSON, so this is a web page or something else at that URL.
  if (error instanceof SyntaxError) {
    return `${subject(connection)} sent an answer that isn't the tracker's. ${CHECK_URL}`;
  }
  return error instanceof Error ? error.message : String(error);
}
