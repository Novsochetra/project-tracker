import { describe, expect, it } from 'vitest';
import type { HelperJob } from '../../../src/watch/autostart/job';
import { systemdUnit, unitNameOf, unitUrl } from '../../../src/watch/autostart/systemd/unitFile';

const job: HelperJob = {
  label: 'com.project-tracker.watch.0123456789ab',
  program: [
    '/usr/bin/env',
    'node',
    '/opt/tracker/cli.js',
    'watch',
    '--url=https://t.example.com',
    '--as=Claude (home)',
    '--name=100% "Dara\'s" $HOME \\box',
    'MOB',
  ],
  folder: '/home/dara/code/my app',
  environment: { PATH: '/home/dara/.local/bin:/usr/bin', TRACKER_CONFIG: '/home/dara/c%d.json' },
};

describe('the systemd user unit', () => {
  it('is named after the folder’s label', () => {
    expect(unitNameOf(job.label)).toBe('com.project-tracker.watch.0123456789ab.service');
  });

  it('starts the helper in its folder at boot, again after a crash only, into the journal', () => {
    expect(systemdUnit(job)).toBe(`[Unit]
Description=tracker watch in /home/dara/code/my app

[Service]
WorkingDirectory=/home/dara/code/my app
Environment="PATH=/home/dara/.local/bin:/usr/bin"
Environment="TRACKER_CONFIG=/home/dara/c%%d.json"
ExecStart=/usr/bin/env node /opt/tracker/cli.js watch --url=https://t.example.com "--as=Claude (home)" "--name=100%% \\"Dara's\\" $$HOME \\\\box" MOB
Restart=on-failure
RestartSec=120
KillMode=mixed
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=default.target
`);
  });

  it('refuses a value with a line break, which would add a setting of its own', () => {
    const folder = '/home/dara/x\nExecStartPre=/bin/rm -rf /home/dara';
    expect(() => systemdUnit({ ...job, folder })).toThrow('line break');
    expect(() => systemdUnit({ ...job, program: ['/usr/bin/env', 'a\rb'] })).toThrow('line break');
  });

  it('gives back the tracker it was installed for', () => {
    expect(unitUrl(systemdUnit(job))).toBe('https://t.example.com');
    const odd = { ...job, program: ['/usr/bin/env', '--url=https://t.example.com/a%20b$'] };
    expect(unitUrl(systemdUnit(odd))).toBe('https://t.example.com/a%20b$');
    expect(unitUrl('[Service]\nExecStart=/usr/bin/env node cli.js watch\n')).toBeUndefined();
  });
});
