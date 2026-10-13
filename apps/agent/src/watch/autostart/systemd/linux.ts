import { existsSync } from 'node:fs';
import { homedir, userInfo } from 'node:os';
import { join } from 'node:path';
import type { Autostart } from '../platform';
import { runCommand } from '../run';
import { runningLines } from '../statusText';
import {
  installedUnitUrl,
  installUnit,
  uninstallUnit,
  unitInstalled,
  unitState,
  type Systemd,
} from './systemctl';
import { unitNameOf } from './unitFile';

export interface LinuxSetup extends Systemd {
  lingerFolder: string;
  user: string;
}

const defaults = (): LinuxSetup => ({
  run: runCommand,
  unitFolder: join(homedir(), '.config', 'systemd', 'user'),
  lingerFolder: '/var/lib/systemd/linger',
  user: userInfo().username,
});

const logCommand = (label: string): string => `journalctl --user -u ${unitNameOf(label)}`;

const lingers = (setup: LinuxSetup): boolean => existsSync(join(setup.lingerFolder, setup.user));

// Without lingering, the user's services start at login and stop at logout, not at boot.
function turnOnLinger(setup: LinuxSetup): boolean {
  if (lingers(setup)) return true;
  try {
    setup.run('loginctl', ['enable-linger', setup.user]);
    return true;
  } catch {
    return false;
  }
}

const bootLine = (setup: LinuxSetup): string =>
  lingers(setup)
    ? 'Starts at boot: yes.'
    : `Starts at boot: no, only once you log in. To change that, run: sudo loginctl enable-linger ${setup.user}`;

export function linuxAutostart(setup: LinuxSetup = defaults()): Autostart {
  return {
    isInstalled: (label) => unitInstalled(setup, label),
    installedUrl: (label) => installedUnitUrl(setup, label),
    runningPid: (label) => unitState(setup, label).pid,
    statusLines: (label) => {
      const { pid, lastExit } = unitState(setup, label);
      return [...runningLines(pid, lastExit, logCommand(label)), bootLine(setup)];
    },
    install: (job) => {
      installUnit(setup, job);
      const atBoot = turnOnLinger(setup);
      return {
        starts: `it starts when ${atBoot ? 'this computer starts' : 'you log in'}, and again if it crashes`,
        notes: [
          `Logs: ${logCommand(job.label)} -f`,
          atBoot
            ? undefined
            : `To start it at boot, before you log in, run: sudo loginctl enable-linger ${setup.user}`,
        ],
      };
    },
    uninstall: (label) => uninstallUnit(setup, label),
  };
}
