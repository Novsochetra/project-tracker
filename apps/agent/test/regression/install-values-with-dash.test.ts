import { describe, expect, it } from 'vitest';
import { parseCliArgs } from '../../src/cli/args';
import { jobFor } from '../../src/watch/autostart/job';

// Reviewer 143: a name starting with "-" was written as "--name -x", which the CLI refuses as an
// ambiguous argument, so the installed helper exited with a usage error every two minutes.
describe('regression: installed values that start with a dash', () => {
  it('reach the helper as the values they were', () => {
    const job = jobFor(
      {
        config: { url: 'https://t.example.com', token: undefined, agentName: '-bot' },
        configPath: '/c.json',
        folder: '/code/mobile',
        projectKey: 'MOB',
        args: { name: '-x', permissionMode: 'plan' },
        env: {},
      },
      [],
    );
    const parsed = parseCliArgs(job.program);
    expect(parsed).toMatchObject({
      command: 'watch',
      args: ['MOB'],
      global: { url: 'https://t.example.com', as: '-bot' },
      options: { name: '-x', 'permission-mode': 'plan' },
    });
  });
});
