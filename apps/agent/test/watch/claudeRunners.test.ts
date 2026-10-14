import { existsSync, readdirSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { Attachment, RunStepInput } from '@tracker/shared';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { ASK_FOLDER_PREFIX } from '../../src/watch/ask/askFiles';
import { askOutcomeOf } from '../../src/watch/ask/askOutcome';
import { claudeRunners, type ClaudeSetup } from '../../src/watch/claudeRunners';
import type { ClaudeExit } from '../../src/watch/outcome';
import { askJob, job } from './fakeTracker';
import { installFakeClaude } from './fakeClaude';

const fake = installFakeClaude();
const cwd = realpathSync(tmpdir());
const opened: ReturnType<typeof claudeRunners>[] = [];
const runners = (setup: ClaudeSetup) => {
  const made = claudeRunners(setup);
  opened.push(made);
  return made;
};
afterAll(() => {
  for (const claude of opened) claude.closeChats();
  fake.remove();
});

const prompts = {
  command: ['node', 'promptTool.js'],
  ask: () => Promise.reject(new Error('unused')),
};

const ask = () => ({ ...askJob('r-1', 'c-1'), prompt: 'Where is X?' });

describe('claudeRunners', () => {
  it("turns Claude's events into steps, never what a tool gave back", async () => {
    const claude = runners({ command: fake.command, cwd, write: () => undefined, prompts });
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
    const claude = runners({
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
    const unlimited = runners({ command: fake.command, cwd, write: () => undefined });
    expect(argsOf(await unlimited.runAsk(ask(), stop, () => undefined))).not.toContain(
      '--max-turns',
    );
  });

  it('drops an event it cannot read and still answers', async () => {
    const claude = runners({
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

  it("removes the question's files when it is stopped, and the chat's folder when it closes", async () => {
    const claude = runners({
      command: fake.command,
      cwd,
      write: () => undefined,
      fetchFile: () => Promise.resolve(new Response('a')),
    });
    const stop = new AbortController();
    const files = [{ id: 'f1', fileName: 'stop-me.txt' } as Attachment];
    const inside = (dir: string) =>
      readdirSync(dir)
        .filter((name) => name.startsWith(ASK_FOLDER_PREFIX))
        .map((name) => join(dir, name));
    // A helper killed mid-question leaves its folders behind (askFolderSweep), so only new ones.
    const before = new Set(inside(tmpdir()));
    const turns = () =>
      inside(tmpdir())
        .filter((dir) => !before.has(dir))
        .flatMap(inside)
        .filter((turn) => existsSync(join(turn, 'stop-me.txt')));
    const running = claude.runAsk(
      { ...ask(), prompt: 'WAIT', files },
      stop.signal,
      () => undefined,
    );
    await vi.waitFor(() => expect(turns()).toHaveLength(1));
    const [turn] = turns();
    stop.abort();
    await running.catch(() => undefined);
    expect(existsSync(turn!)).toBe(false);
    claude.closeChats();
    await vi.waitFor(() => expect(existsSync(dirname(turn!))).toBe(false));
  });
});
