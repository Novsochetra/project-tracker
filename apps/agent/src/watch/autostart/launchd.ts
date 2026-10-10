import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { AutostartError } from './errors';
import { plistPathOf } from './names';
import { launchAgentPlist, type LaunchAgent } from './plist';

const domain = (): string => `gui/${process.getuid!()}`;

const run = (command: string, args: string[]): string =>
  execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

const failureOf = (error: unknown): string => {
  const failed = error as { stderr?: string; message?: string };
  return (failed.stderr || failed.message || '').trim();
};

export const jobState = (label: string): string | undefined => {
  try {
    return run('/bin/launchctl', ['print', `${domain()}/${label}`]);
  } catch {
    return undefined;
  }
};

// Booting out a job that isn't loaded fails with a code that differs between macOS versions.
function stopJob(label: string): void {
  if (jobState(label) === undefined) return;
  try {
    run('/bin/launchctl', ['bootout', `${domain()}/${label}`]);
  } catch (error) {
    throw new AutostartError(`launchctl couldn't stop it: ${failureOf(error)}`);
  }
}

export const isInstalled = (label: string): boolean => existsSync(plistPathOf(label));

export function installAgent(agent: LaunchAgent): void {
  const path = plistPathOf(agent.label);
  mkdirSync(dirname(path), { recursive: true });
  mkdirSync(dirname(agent.logPath), { recursive: true });
  stopJob(agent.label);
  writeFileSync(path, launchAgentPlist(agent), { mode: 0o644 });
  try {
    run('/bin/launchctl', ['bootstrap', domain(), path]);
  } catch (error) {
    rmSync(path, { force: true });
    throw new AutostartError(`launchctl couldn't start it: ${failureOf(error)}`);
  }
}

export function uninstallAgent(label: string): boolean {
  stopJob(label);
  if (!isInstalled(label)) return false;
  rmSync(plistPathOf(label));
  return true;
}

export function plistUrl(label: string): string | undefined {
  try {
    const json = run('/usr/bin/plutil', ['-convert', 'json', '-o', '-', plistPathOf(label)]);
    const program = (JSON.parse(json) as { ProgramArguments?: string[] }).ProgramArguments ?? [];
    const url = program.find((arg) => arg.startsWith('--url='));
    return url?.slice('--url='.length);
  } catch {
    return undefined;
  }
}
