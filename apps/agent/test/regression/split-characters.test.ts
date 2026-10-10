import { realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { afterAll, describe, expect, it } from 'vitest';
import { runClaude } from '../../src/watch/claude';
import { installFakeClaude } from '../watch/fakeClaude';

// Reviewer 140: a character whose bytes arrived in two chunks came out as "caf��".
describe('regression: characters split across chunks', () => {
  const fake = installFakeClaude();
  afterAll(() => fake.remove());

  it('stay whole in what is shown and reported', async () => {
    const shown: string[] = [];
    const exit = await runClaude(
      { command: fake.command, args: ['-p'], cwd: realpathSync(tmpdir()) },
      'SPLIT',
      new AbortController().signal,
      { onOutput: (text) => shown.push(text), onEvent: () => undefined },
    );
    expect(exit.output).toContain('café ✓');
    expect(shown.join('')).toContain('café ✓');
  });
});
