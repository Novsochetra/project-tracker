import { plainHttpProblem, PlainHttpError } from './plainHttp';
import { NO_SAVED_CONFIG, savedToken, type SavedConfig } from './savedConfig';

export const DEFAULT_URL = 'http://localhost:4100';
export const DEFAULT_AGENT_NAME = 'Claude';

// Where the API token came from, so an error can say which one the tracker refused.
export type TokenSource = '--token' | 'TRACKER_API_TOKEN' | 'TRACKER_TOKEN' | 'tracker login';

export interface Config {
  url: string;
  token: string | undefined;
  tokenSource?: TokenSource;
  agentName: string;
}

export interface ConfigOverrides {
  url?: string | undefined;
  token?: string | undefined;
  as?: string | undefined;
}

export type Env = Record<string, string | undefined>;

const clean = (value: string | undefined): string | undefined => value?.trim() || undefined;

const firstSet = (...values: (string | undefined)[]): string | undefined =>
  values.map(clean).find((value) => value !== undefined);

export const trackerUrl = (env: Env, overrides: ConfigOverrides, saved: SavedConfig): string =>
  firstSet(overrides.url, env.TRACKER_URL, saved.url) ?? DEFAULT_URL;

// TRACKER_TOKEN was the name before API tokens; it still works. A saved token is only sent to
// the tracker it was saved for.
function findToken(env: Env, overrides: ConfigOverrides, saved: SavedConfig, url: string) {
  const candidates: [TokenSource, string | undefined][] = [
    ['--token', overrides.token],
    ['TRACKER_API_TOKEN', env.TRACKER_API_TOKEN],
    ['TRACKER_TOKEN', env.TRACKER_TOKEN],
    ['tracker login', savedToken(saved, url)],
  ];
  const found = candidates.find(([, value]) => clean(value) !== undefined);
  return found ? { token: clean(found[1]), tokenSource: found[0] } : { token: undefined };
}

export function loadConfig(
  env: Env,
  overrides: ConfigOverrides = {},
  saved: SavedConfig = NO_SAVED_CONFIG,
): Config {
  const url = trackerUrl(env, overrides, saved);
  const token = findToken(env, overrides, saved, url);
  const problem = token.token === undefined ? undefined : plainHttpProblem(url);
  if (problem) throw new PlainHttpError(problem);
  return {
    url,
    ...token,
    agentName: firstSet(overrides.as, env.TRACKER_AGENT_NAME) ?? DEFAULT_AGENT_NAME,
  };
}
