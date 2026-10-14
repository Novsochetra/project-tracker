import { existsSync, readdirSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Attachment, RunStepInput } from '@tracker/shared';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { ASK_FOLDER_PREFIX } from '../../src/watch/ask/askFiles';
import { askOutcomeOf } from '../../src/watch/ask/askOutcome';
import { claudeRunners } from '../../src/watch/claudeRunners';
import type { ClaudeExit } from '../../src/watch/outcome';
import { askJob, job } from './fakeTracker';
import { installFakeClaude } from './fakeClaude';

const fake = installFakeClaude();
const cwd = realpathSync(tmpdir());
afterAll(() => fake.remove());

const prompts = {
  command: ['node', 'promptTool.js'],
  ask: () => Promise.reject(new Error('unused')),
};

const ask = () => ({ ...askJob('r-1', 'c-1'), prompt: 'Where is X?' });

describe('claudeRunners', () => {
  it("turns Claude's events into steps, never what a tool gave back", async () => {
    const claude = claudeRunners({ command: fake.command, cwd, write: () => undefined, prompts });
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
      prompts,
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

  it("removes the question's folder when the question is stopped while Claude works", async () => {
    const claude = claudeRunners({
      command: fake.command,
      cwd,
      write: () => undefined,
      fetchFile: () => Promise.resolve(new Response('a')),
    });
    const stop = new AbortController();
    const files = [{ id: 'f1', fileName: 'stop-me.txt' } as Attachment];
    const folders = () =>
      readdirSync(tmpdir())
        .filter((name) => name.startsWith(ASK_FOLDER_PREFIX))
        .map((name) => join(tmpdir(), name))
        .filter((dir) => existsSync(join(dir, 'stop-me.txt')));
    const running = claude.runAsk(
      { ...ask(), prompt: 'WAIT', files },
      stop.signal,
      () => undefined,
    );
    await vi.waitFor(() => expect(folders()).toHaveLength(1));
    const [dir] = folders();
    stop.abort();
    await running.catch(() => undefined);
    expect(existsSync(dir!)).toBe(false);
  });
});
