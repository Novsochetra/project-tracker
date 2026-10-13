import { describe, expect, it } from 'vitest';
import type { Config } from '../../../src/config';
import { jobFor, type JobInput } from '../../../src/watch/autostart/job';

const config: Config = { url: 'https://t.example.com', token: 'trk_secret', agentName: 'Claude' };
const input = (changes: Partial<JobInput> = {}): JobInput => ({
  config,
  configPath: '/Users/dara/.config/project-tracker/config.json',
  folder: '/Users/dara/code/mobile',
  projectKey: 'MOB',
  args: {},
  env: {
    PATH: '/opt/homebrew/bin:/usr/bin',
    XDG_CONFIG_HOME: '/elsewhere',
    TRACKER_API_TOKEN: 'x',
  },
  ...changes,
});
const CLI = ['/usr/bin/env', 'node', '/repo/apps/agent/dist/cli.js'];

describe('the job tracker watch installs', () => {
  it('runs the same tracker, choices and project, with the config file named outright', () => {
    const job = jobFor(
      input({
        config: { ...config, agentName: 'Claude (home)' },
        args: { name: 'Mac', permissionMode: 'acceptEdits', keepAwake: false, approvals: true },
      }),
      CLI,
    );
    expect(job.program).toEqual([
      ...CLI,
      'watch',
      '--url=https://t.example.com',
      '--as=Claude (home)',
      '--name=Mac',
      '--permission-mode=acceptEdits',
      '--no-keep-awake',
      '--approvals',
      'MOB',
    ]);
    expect(job.environment).toEqual({
      PATH: '/opt/homebrew/bin:/usr/bin',
      TRACKER_CONFIG: '/Users/dara/.config/project-tracker/config.json',
    });
    expect(JSON.stringify(job)).not.toContain('trk_secret');
    expect(job.logPath).toContain(`${job.label}.log`);
  });

  it('refuses a project key shaped like a flag, which could come from the tracker', () => {
    expect(() => jobFor(input({ projectKey: '--permission-mode=bypassPermissions' }), CLI)).toThrow(
      `"--permission-mode=bypassPermissions" isn't a project key.`,
    );
  });

  it('starts node through env, so an upgrade that moves node keeps it working', () => {
    expect(jobFor(input()).program.slice(0, 2)).toEqual(['/usr/bin/env', 'node']);
  });
});
