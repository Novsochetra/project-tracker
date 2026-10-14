import { realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { DEFAULT_ASK_OPTIONS, type AskMode } from '@tracker/shared';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { askOutcomeOf } from '../../src/watch/ask/askOutcome';
import { claudeRunners } from '../../src/watch/claudeRunners';
import type { AskPerson } from '../../src/watch/permissionTool/askPerson';
import { askJob, job } from '../watch/fakeTracker';
import { installFakeClaude } from '../watch/fakeClaude';

const fake = installFakeClaude();
afterAll(() => fake.remove());

const claude = claudeRunners({
  command: fake.command,
  cwd: realpathSync(tmpdir()),
  write: () => undefined,
  prompts: { command: ['node', 'promptTool.js'], ask: vi.fn<AskPerson>() },
});

const argsOf = (answer = '') => JSON.parse(/^ARGS (.*)$/m.exec(answer)?.[1] ?? '[]') as string[];
const stop = () => new AbortController().signal;

describe('regression: every run can ask the person', () => {
  it('gives a ticket run ask_person', async () => {
    const exit = await claude.runClaude(job('r-1', 'MOB-1'), stop(), () => undefined);
    expect(argsOf(exit.results[0]?.text)).toContain('mcp__tracker-watch__ask_person');
  });

  it.each(['ask', 'plan', 'edit', 'auto'] as const)(
    'gives a %s question ask_person',
    async (mode: AskMode) => {
      const question = {
        ...askJob('r-1', 'c-1', null, { ...DEFAULT_ASK_OPTIONS, mode }),
        prompt: 'X',
      };
      const outcome = askOutcomeOf(await claude.runAsk(question, stop(), () => undefined), false);
      expect(argsOf(outcome.answer)).toContain('mcp__tracker-watch__ask_person');
    },
  );
});
