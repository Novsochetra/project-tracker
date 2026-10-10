import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { launchAgentPlist, type LaunchAgent } from './plist';

export const plistPathOf = (label: string): string =>
  join(homedir(), 'Library', 'LaunchAgents', `${label}.plist`);

const domain = (): string => `gui/${process.getuid?.() ?? 0}`;

const launchctl = (...args: string[]): string =>
  execFileSync('launchctl', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

function stopJob(label: string): void {
  try {
    launchctl('bootout', `${domain()}/${label}`);
  } catch {
    return;
  }
}

export function installAgent(agent: LaunchAgent): string {
  const path = plistPathOf(agent.label);
  mkdirSync(dirname(path), { recursive: true });
  mkdirSync(dirname(agent.logPath), { recursive: true });
  stopJob(agent.label);
  writeFileSync(path, launchAgentPlist(agent), { mode: 0o644 });
  launchctl('bootstrap', domain(), path);
  return path;
}

export function uninstallAgent(label: string): boolean {
  const path = plistPathOf(label);
  stopJob(label);
  if (!existsSync(path)) return false;
  rmSync(path);
  return true;
}

export function runningPid(label: string): number | undefined {
  try {
    const pid = /^\s*pid = (\d+)$/m.exec(launchctl('print', `${domain()}/${label}`))?.[1];
    return pid === undefined ? undefined : Number(pid);
  } catch {
    return undefined;
  }
}
