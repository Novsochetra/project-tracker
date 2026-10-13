import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { check } from '../../../src/watch/autostart/check';
import type { HelperJob } from '../../../src/watch/autostart/job';
import { labelFor } from '../../../src/watch/autostart/names';
import type { Run } from '../../../src/watch/autostart/run';
import { linuxAutostart, type LinuxSetup } from '../../../src/watch/autostart/systemd/linux';
import { memoryStore } from '../../memoryStore';

type Answer = string | Error;

function fakeRun(answers: Record<string, Answer> = {}) {
  const calls: string[] = [];
  const run: Run = (command, args) => {
    const line = [command, ...args].join(' ');
    calls.push(line);
    const found = Object.entries(answers).find(([start]) => line.startsWith(start))?.[1] ?? '';
    if (found instanceof Error) throw found;
    return found;
  };
  return { run, calls };
}

const failure = (stderr: string): Error => Object.assign(new Error('exit 1'), { stderr });

describe('starting by itself on Linux (systemd)', () => {
  let root: string;
  let folder: string;
  let job: HelperJob;
  const setupWith = (run: Run): LinuxSetup => ({
    run,
    unitFolder: join(root, 'systemd', 'user'),
    lingerFolder: join(root, 'linger'),
    user: 'dara',
  });
  const unitPath = () => join(root, 'systemd', 'user', `${job.label}.service`);
  const unit = () => `${job.label}.service`;

  beforeEach(() => {
    root = realpathSync(mkdtempSync(join(tmpdir(), 'systemd-')));
    folder = join(root, 'code');
    mkdirSync(folder);
    job = {
      label: labelFor(folder),
      program: [
        '/usr/bin/env',
        'node',
        '/opt/cli.js',
        'watch',
        '--url=https://t.example.com',
        'MOB',
      ],
      folder,
      environment: { PATH: '/usr/bin' },
    };
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('writes the unit, enables it and (re)starts it, and turns on lingering for boot', () => {
    const { run, calls } = fakeRun();
    const installed = linuxAutostart(setupWith(run)).install(job);
    expect(readFileSync(unitPath(), 'utf8')).toContain('ExecStart=/usr/bin/env node /opt/cli.js');
    expect(calls).toEqual([
      'systemctl --user daemon-reload',
      `systemctl --user enable ${unit()}`,
      `systemctl --user restart ${unit()}`,
      'loginctl enable-linger dara',
    ]);
    expect(installed.starts).toBe('it starts when this computer starts, and again if it crashes');
    expect(installed.notes).toEqual([`Logs: journalctl --user -u ${unit()} -f`, undefined]);
  });

  it('leaves lingering alone when it is on, and says how to turn it on when it can’t', () => {
    mkdirSync(join(root, 'linger'));
    writeFileSync(join(root, 'linger', 'dara'), '');
    const on = fakeRun();
    linuxAutostart(setupWith(on.run)).install(job);
    expect(on.calls.some((call) => call.startsWith('loginctl'))).toBe(false);

    rmSync(join(root, 'linger', 'dara'));
    const refused = fakeRun({ loginctl: failure('Access denied') });
    const installed = linuxAutostart(setupWith(refused.run)).install(job);
    expect(installed.starts).toBe('it starts when you log in, and again if it crashes');
    expect(installed.notes[1]).toBe(
      'To start it at boot, before you log in, run: sudo loginctl enable-linger dara',
    );
  });

  it('removes the unit again when systemd won’t start it, and says why', () => {
    const { run, calls } = fakeRun({
      'systemctl --user restart': failure('Failed to connect to bus: No medium found'),
    });
    expect(() => linuxAutostart(setupWith(run)).install(job)).toThrow(
      'systemctl --user restart failed: Failed to connect to bus: No medium found',
    );
    expect(existsSync(unitPath())).toBe(false);
    expect(calls.slice(-2)).toEqual([
      `systemctl --user disable --now ${unit()}`,
      'systemctl --user daemon-reload',
    ]);
  });

  it('uninstalls by stopping, disabling and deleting the unit', () => {
    const { run, calls } = fakeRun();
    const autostart = linuxAutostart(setupWith(run));
    expect(autostart.uninstall(job.label)).toBe(false);
    expect(calls).toEqual([]);
    autostart.install(job);
    calls.length = 0;
    expect(autostart.uninstall(job.label)).toBe(true);
    expect(existsSync(unitPath())).toBe(false);
    expect(calls).toEqual([
      `systemctl --user disable --now ${unit()}`,
      'systemctl --user daemon-reload',
    ]);
  });

  it('checks whether it is installed, running and starting at boot', async () => {
    const lines: string[] = [];
    const io = {
      env: {},
      store: memoryStore(),
      cwd: folder,
      stdout: (text: string) => lines.push(text),
      write: () => undefined,
      untilStopped: () => new Promise<void>(() => undefined),
    };
    const global = { json: false, help: false, version: false };
    const running = fakeRun({ 'systemctl --user show': 'MainPID=4242\nExecMainStatus=0\n' });
    const autostart = linuxAutostart(setupWith(running.run));
    await check(global, io, autostart);
    expect(lines.pop()).toContain('Installed: no.');

    autostart.install(job);
    await check(global, io, autostart);
    expect(lines.pop()).toContain(
      'Installed: yes.\nRunning by itself: yes (process 4242).\nStarts at boot: no, only once you log in. To change that, run: sudo loginctl enable-linger dara\nAt the tracker: this folder has never checked in to https://t.example.com.',
    );
    expect(running.calls).toContain(
      `systemctl --user show --property=MainPID,ExecMainStatus ${unit()}`,
    );

    const stopped = fakeRun({ 'systemctl --user show': 'MainPID=0\nExecMainStatus=1\n' });
    await check(global, io, linuxAutostart(setupWith(stopped.run)));
    expect(lines.pop()).toContain(
      `Running by itself: no (last exit code: 1).\nLog: journalctl --user -u ${unit()}\n`,
    );
  });
});
