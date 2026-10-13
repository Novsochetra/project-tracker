import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { AutostartError } from '../errors';
import type { HelperJob } from '../job';
import { failureOf, type Run } from '../run';
import { systemdUnit, unitNameOf, unitUrl } from './unitFile';

export interface Systemd {
  run: Run;
  unitFolder: string;
}

export interface UnitState {
  pid?: number;
  lastExit?: string;
}

const unitPathOf = (systemd: Systemd, label: string): string =>
  join(systemd.unitFolder, unitNameOf(label));

function systemctl(systemd: Systemd, args: readonly string[]): string {
  try {
    return systemd.run('systemctl', ['--user', ...args]);
  } catch (error) {
    throw new AutostartError(`systemctl --user ${args[0]} failed: ${failureOf(error)}`);
  }
}

function quietly(systemd: Systemd, args: readonly string[]): void {
  try {
    systemctl(systemd, args);
  } catch {
    return;
  }
}

export const unitInstalled = (systemd: Systemd, label: string): boolean =>
  existsSync(unitPathOf(systemd, label));

// restart, not start, so installing again replaces a helper that runs with the old choices.
export function installUnit(systemd: Systemd, job: HelperJob): void {
  const path = unitPathOf(systemd, job.label);
  const unit = unitNameOf(job.label);
  mkdirSync(systemd.unitFolder, { recursive: true });
  writeFileSync(path, systemdUnit(job), { mode: 0o644 });
  try {
    for (const args of [['daemon-reload'], ['enable', unit], ['restart', unit]]) {
      systemctl(systemd, args);
    }
  } catch (error) {
    quietly(systemd, ['disable', '--now', unit]);
    rmSync(path, { force: true });
    quietly(systemd, ['daemon-reload']);
    throw error;
  }
}

export function uninstallUnit(systemd: Systemd, label: string): boolean {
  if (!unitInstalled(systemd, label)) return false;
  systemctl(systemd, ['disable', '--now', unitNameOf(label)]);
  rmSync(unitPathOf(systemd, label));
  systemctl(systemd, ['daemon-reload']);
  return true;
}

const field = (text: string, name: string): string | undefined =>
  new RegExp(`^${name}=(.*)$`, 'm').exec(text)?.[1]?.trim() || undefined;

export function unitState(systemd: Systemd, label: string): UnitState {
  let text: string;
  try {
    text = systemctl(systemd, ['show', '--property=MainPID,ExecMainStatus', unitNameOf(label)]);
  } catch {
    return {};
  }
  const pid = Number(field(text, 'MainPID'));
  const lastExit = field(text, 'ExecMainStatus');
  return { ...(pid > 0 && { pid }), ...(lastExit !== undefined && { lastExit }) };
}

export function installedUnitUrl(systemd: Systemd, label: string): string | undefined {
  try {
    return unitUrl(readFileSync(unitPathOf(systemd, label), 'utf8'));
  } catch {
    return undefined;
  }
}
