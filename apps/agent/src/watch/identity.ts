import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { hostname } from 'node:os';
import { RUNNER_NAME_MAX } from '@tracker/shared';
import type { ConfigStore } from '../configFile';
import { trackerKey } from '../savedConfig';

export function runnerIdFor(store: ConfigStore, trackerUrl: string, folder: string): string {
  const saved = store.read();
  const key = `${trackerKey(trackerUrl)} ${folder}`;
  const known = saved.runners?.[key];
  if (known) return known;
  const id = randomUUID();
  store.write({ ...saved, runners: { ...saved.runners, [key]: id } });
  return id;
}

// On some Macs the host name is the network address; the Sharing name is the one people know.
function macName(): string | undefined {
  try {
    return (
      execFileSync('scutil', ['--get', 'ComputerName'], { encoding: 'utf8' }).trim() || undefined
    );
  } catch {
    return undefined;
  }
}

export function computerName(): string {
  const name = (process.platform === 'darwin' && macName()) || hostname().replace(/\.local$/, '');
  return name.slice(0, RUNNER_NAME_MAX);
}
