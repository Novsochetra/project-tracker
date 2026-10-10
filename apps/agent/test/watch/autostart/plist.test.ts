import { describe, expect, it } from 'vitest';
import { labelFor, launchAgentPlist } from '../../../src/watch/autostart/plist';
import { watchArgsFor } from '../../../src/watch/autostart/program';
import { caffeinateArgs } from '../../../src/watch/keepAwake';

const agent = {
  label: labelFor('/Users/dara/code/mobile'),
  program: [
    '/usr/local/bin/node',
    '/opt/tracker/cli.js',
    'watch',
    'MOB',
    '--name',
    'Dara & Co <Mac>',
  ],
  folder: '/Users/dara/code/mobile',
  logPath: '/Users/dara/Library/Logs/project-tracker-watch-MOB.log',
  environment: { PATH: '/Users/dara/.local/bin:/usr/bin' },
};

describe('the LaunchAgent', () => {
  it('has one label per folder', () => {
    expect(agent.label).toMatch(/^com\.project-tracker\.watch\.[0-9a-f]{12}$/);
    expect(labelFor('/Users/dara/code/mobile')).toBe(agent.label);
    expect(labelFor('/Users/dara/code/web')).not.toBe(agent.label);
  });

  it('starts the helper in its folder at login, again after a crash, with PATH for claude', () => {
    const plist = launchAgentPlist(agent);
    expect(plist).toContain(`<key>Label</key><string>${agent.label}</string>`);
    expect(plist).toContain(
      '<array><string>/usr/local/bin/node</string><string>/opt/tracker/cli.js</string><string>watch</string><string>MOB</string><string>--name</string><string>Dara &amp; Co &lt;Mac&gt;</string></array>',
    );
    expect(plist).toContain('<key>WorkingDirectory</key><string>/Users/dara/code/mobile</string>');
    expect(plist).toContain('<key>PATH</key><string>/Users/dara/.local/bin:/usr/bin</string>');
    expect(plist).toContain('<key>RunAtLoad</key><true/>');
    expect(plist).toContain('<key>KeepAlive</key><dict><key>SuccessfulExit</key><false/></dict>');
    expect(plist).toContain(`<key>StandardErrorPath</key><string>${agent.logPath}</string>`);
    expect(plist).not.toMatch(/trk_|TRACKER_API_TOKEN/);
  });

  it('passes on the choices made at install, and the tracker by its address', () => {
    expect(watchArgsFor('MOB', 'https://t.example.com', {})).toEqual([
      'watch',
      'MOB',
      '--url',
      'https://t.example.com',
    ]);
    expect(
      watchArgsFor('MOB', 'https://t.example.com', {
        name: 'Mac',
        permissionMode: 'acceptEdits',
        keepAwake: false,
      }),
    ).toEqual([
      'watch',
      'MOB',
      '--url',
      'https://t.example.com',
      '--name',
      'Mac',
      '--permission-mode',
      'acceptEdits',
      '--no-keep-awake',
    ]);
  });
});

describe('keeping the Mac awake', () => {
  it('stops idle sleep only, for as long as the helper lives', () => {
    expect(caffeinateArgs(4242)).toEqual(['-i', '-w', '4242']);
  });
});
