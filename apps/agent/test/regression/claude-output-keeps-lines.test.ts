import { realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { afterAll, describe, expect, it } from 'vitest';
import { runClaude } from '../../src/watch/claude';
import { outcomeOf } from '../../src/watch/outcome';
import { installFakeClaude } from '../watch/fakeClaude';

// Reviewer 140: the output was trimmed after every chunk, so lines that arrived apart were glued
// together in the reason a run failed ("first linesecond line").
describe('regression: Claude output keeps its line breaks', () => {
  const fake = installFakeClaude();
  afterAll(() => fake.remove());

  it('reports lines that arrived apart on lines of their own', async () => {
    const exit = await runClaude(
      { command: fake.command, cwd: realpathSync(tmpdir()) },
      'TWO LINES',
      new AbortController().signal,
      () => undefined,
    );
    expect(outcomeOf(exit, false)).toMatchObject({
      status: 'failed',
      error: expect.stringContaining('first line\nsecond line'),
    });
  });
});
