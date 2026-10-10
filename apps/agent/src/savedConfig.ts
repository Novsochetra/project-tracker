import { z } from 'zod';

export interface SavedConfig {
  // The tracker the CLI and MCP server use when neither --url nor TRACKER_URL names one.
  url?: string;
  // API tokens by tracker, so a token only ever goes to the tracker it was made for.
  tokens: Record<string, string>;
  // tracker watch's id per tracker and folder, so runs queued while it restarts still find it.
  runners?: Record<string, string>;
}

export const NO_SAVED_CONFIG: SavedConfig = { tokens: {} };

const savedConfigSchema = z.object({
  url: z.string().optional(),
  tokens: z.record(z.string(), z.string()).default({}),
  runners: z.record(z.string(), z.string()).optional(),
});

export class ConfigFileError extends Error {
  override name = 'ConfigFileError';
}

export function parseSavedConfig(text: string, path: string): SavedConfig {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ConfigFileError(`${path} is not valid JSON. Fix it, or delete it and log in again.`);
  }
  const result = savedConfigSchema.safeParse(data);
  if (!result.success) {
    throw new ConfigFileError(
      `${path} should look like {"url": "...", "tokens": {"<url>": "trk_..."}}. Fix it, or delete it and log in again.`,
    );
  }
  const { url, tokens, runners } = result.data;
  return { ...(url === undefined ? {} : { url }), tokens, ...(runners ? { runners } : {}) };
}

// "https://Tracker.example.com/" and "https://tracker.example.com" are the same tracker.
export function trackerKey(url: string): string {
  const trimmed = url.trim();
  try {
    const parsed = new URL(trimmed);
    return `${parsed.origin}${parsed.pathname.replace(/\/+$/, '')}`;
  } catch {
    return trimmed.replace(/\/+$/, '');
  }
}

export const savedToken = (saved: SavedConfig, url: string): string | undefined =>
  saved.tokens[trackerKey(url)];

export const withToken = (saved: SavedConfig, url: string, token: string): SavedConfig => {
  const key = trackerKey(url);
  return { ...saved, url: key, tokens: { ...saved.tokens, [key]: token } };
};

export function withoutToken(saved: SavedConfig, url: string): SavedConfig {
  const key = trackerKey(url);
  const tokens = Object.fromEntries(Object.entries(saved.tokens).filter(([name]) => name !== key));
  const keepUrl = saved.url !== undefined && trackerKey(saved.url) !== key;
  const { url: _url, ...rest } = saved;
  return keepUrl ? { ...rest, url: saved.url, tokens } : { ...rest, tokens };
}
