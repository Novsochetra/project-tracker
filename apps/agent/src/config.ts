export const DEFAULT_URL = 'http://localhost:4100';
export const DEFAULT_AGENT_NAME = 'Claude';

export interface Config {
  url: string;
  token: string | undefined;
  agentName: string;
}

export interface ConfigOverrides {
  url?: string;
  token?: string;
  as?: string;
}

export type Env = Record<string, string | undefined>;

const firstSet = (...values: (string | undefined)[]): string | undefined =>
  values.map((value) => value?.trim()).find((value) => Boolean(value));

export function loadConfig(env: Env, overrides: ConfigOverrides = {}): Config {
  return {
    url: firstSet(overrides.url, env.TRACKER_URL) ?? DEFAULT_URL,
    token: firstSet(overrides.token, env.TRACKER_TOKEN),
    agentName: firstSet(overrides.as, env.TRACKER_AGENT_NAME) ?? DEFAULT_AGENT_NAME,
  };
}
