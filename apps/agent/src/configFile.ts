import { chmodSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import type { Env } from './config';
import { NO_SAVED_CONFIG, parseSavedConfig, type SavedConfig } from './savedConfig';

export interface ConfigStore {
  path: string;
  read(): SavedConfig;
  write(config: SavedConfig): void;
}

export function configPath(env: Env, home: string = homedir()): string {
  const explicit = env.TRACKER_CONFIG?.trim();
  if (explicit) return explicit;
  const configHome = env.XDG_CONFIG_HOME?.trim() || join(home, '.config');
  return join(configHome, 'project-tracker', 'config.json');
}

const isMissing = (error: unknown): boolean =>
  error instanceof Error && 'code' in error && error.code === 'ENOENT';

function readText(path: string): string | null {
  try {
    return readFileSync(path, 'utf8');
  } catch (error) {
    if (isMissing(error)) return null;
    throw error;
  }
}

// The file holds API tokens, so only its owner may read it, like ~/.ssh. A new file is written
// beside the old one and renamed over it, so a crash never leaves half a file.
function writeConfig(path: string, config: SavedConfig): void {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const next = `${path}.${process.pid}.tmp`;
  writeFileSync(next, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  chmodSync(next, 0o600);
  renameSync(next, path);
}

export const fileStore = (path: string): ConfigStore => ({
  path,
  read: () => {
    const text = readText(path);
    return text === null ? NO_SAVED_CONFIG : parseSavedConfig(text, path);
  },
  write: (config) => writeConfig(path, config),
});
