import { realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import type { RunStepInput } from '@tracker/shared';
import { afterAll, describe, expect, it } from 'vitest';
import { askOutcomeOf } from '../../src/watch/ask/askOutcome';
import { claudeRunners } from '../../src/watch/claudeRunners';
import type { ClaudeExit } from '../../src/watch/outcome';
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
      expect.stringMatching(
        /^text: ARGS \["-p","--output-format","stream-json","--verbose","--allowedTools","mcp__tracker__ask_person,/,
      ),
    ]);
    expect(JSON.stringify(steps)).not.toContain('SECRET');
  });

  it('passes --max-turns to every run, questions too', async () => {
    const claude = claudeRunners({
      command: fake.command,
      cwd,
      write: () => undefined,
      maxTurns: '40',
    });
    const stop = new AbortController().signal;
    const argsOf = (exit: ClaudeExit) =>
      JSON.parse(/ARGS (.*)$/m.exec(exit.results.at(-1)?.text ?? '')?.[1] ?? '[]') as string[];
    const limit = expect.arrayContaining(['--max-turns', '40']);
    expect(argsOf(await claude.runClaude(job('r-1', 'MOB-1'), stop, () => undefined))).toEqual(
      limit,
    );
    expect(argsOf(await claude.runAsk(ask(), stop, () => undefined))).toEqual(limit);
    const unlimited = claudeRunners({ command: fake.command, cwd, write: () => undefined });
    expect(argsOf(await unlimited.runAsk(ask(), stop, () => undefined))).not.toContain(
      '--max-turns',
    );
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
