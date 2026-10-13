import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { AutostartError } from './errors';
import type { HelperJob } from './job';
import { logPathOf, plistPathOf } from './names';
import { launchAgentPlist } from './plist';
import { failureOf, runCommand as run } from './run';

const domain = (): string => `gui/${process.getuid!()}`;

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

export function installAgent(job: HelperJob): void {
  const path = plistPathOf(job.label);
  const logPath = logPathOf(job.label);
  mkdirSync(dirname(path), { recursive: true });
  mkdirSync(dirname(logPath), { recursive: true });
  stopJob(job.label);
  writeFileSync(path, launchAgentPlist({ ...job, logPath }), { mode: 0o644 });
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
