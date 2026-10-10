import { realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import type { RunStepInput } from '@tracker/shared';
import { afterAll, describe, expect, it } from 'vitest';
import { askOutcomeOf } from '../../src/watch/ask/askOutcome';
import { claudeRunners } from '../../src/watch/claudeRunners';
import { askJob, job } from './fakeTracker';
import { installFakeClaude } from './fakeClaude';

const fake = installFakeClaude();
const cwd = realpathSync(tmpdir());
afterAll(() => fake.remove());

const ask = () => ({ ...askJob('r-1', 'c-1'), prompt: 'Where is X?' });

describe('claudeRunners', () => {
  it("turns Claude's events into steps, never what a tool gave back", async () => {
    const claude = claudeRunners({ command: fake.command, cwd, write: () => undefined });
    const steps: RunStepInput[] = [];
    await claude.runClaude(job('r-1', 'MOB-1'), new AbortController().signal, (more) =>
      steps.push(...more),
    );
    expect(steps.map(({ kind, label }) => `${kind}: ${label.split('\n')[0]}`)).toEqual([
      'tool: Read src/app.ts',
      'text: ARGS ["-p","--output-format","stream-json","--verbose"]',
    ]);
    expect(JSON.stringify(steps)).not.toContain('SECRET');
  });

  it('drops an event it cannot read and still answers', async () => {
    const claude = claudeRunners({
      command: fake.command,
      cwd,
      write: () => undefined,
      readSteps: () => () => {
        throw new Error('unreadable event');
      },
    });
    const steps: RunStepInput[] = [];
    const exit = await claude.runAsk(ask(), new AbortController().signal, (more) =>
      steps.push(...more),
    );
    expect(steps).toEqual([]);
    expect(askOutcomeOf(exit, false)).toMatchObject({ status: 'done' });
  });
});
