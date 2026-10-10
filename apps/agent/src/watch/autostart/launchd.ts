import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { AutostartError } from './errors';
import { plistPathOf } from './names';
import { launchAgentPlist, type LaunchAgent } from './plist';

const NOT_LOADED = 3;

const domain = (): string => `gui/${process.getuid!()}`;

const launchctl = (...args: string[]): string =>
  execFileSync('/bin/launchctl', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

const failureOf = (error: unknown): { status?: number; text: string } => {
  const failed = error as { status?: number; stderr?: string; message?: string };
  return { status: failed.status, text: (failed.stderr || failed.message || '').trim() };
};

function stopJob(label: string): void {
  try {
    launchctl('bootout', `${domain()}/${label}`);
  } catch (error) {
    const { status, text } = failureOf(error);
    if (status !== NOT_LOADED) throw new AutostartError(`launchctl couldn't stop it: ${text}`);
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
    launchctl('bootstrap', domain(), path);
  } catch (error) {
    rmSync(path, { force: true });
    throw new AutostartError(`launchctl couldn't start it: ${failureOf(error).text}`);
  }
}

export function uninstallAgent(label: string): boolean {
  stopJob(label);
  if (!isInstalled(label)) return false;
  rmSync(plistPathOf(label));
  return true;
}

export const jobState = (label: string): string | undefined => {
  try {
    return launchctl('print', `${domain()}/${label}`);
  } catch {
    return undefined;
  }
};

export function plistUrl(label: string): string | undefined {
  try {
    const json = execFileSync(
      '/usr/bin/plutil',
      ['-convert', 'json', '-o', '-', plistPathOf(label)],
      {
        encoding: 'utf8',
      },
    );
    const program = (JSON.parse(json) as { ProgramArguments?: string[] }).ProgramArguments ?? [];
    const at = program.indexOf('--url');
    return at === -1 ? undefined : program[at + 1];
  } catch {
    return undefined;
  }
}
