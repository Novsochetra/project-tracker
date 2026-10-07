import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';

const agentDir = fileURLToPath(new URL('..', import.meta.url));

describe('built CLI', () => {
  beforeAll(() => {
    execFileSync('npm', ['run', 'build'], { cwd: agentDir, stdio: 'ignore' });
  }, 120_000);

  it('prints the usage', () => {
    const output = execFileSync(process.execPath, ['dist/cli.js', 'help'], {
      cwd: agentDir,
      encoding: 'utf8',
    });
    expect(output).toContain('Usage: tracker <command> [options]');
    expect(output).toContain('claim <PROJECT|KEY>');
  });
});
