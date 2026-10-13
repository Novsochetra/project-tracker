import { createStepReader, type RunStepInput } from '@tracker/shared';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { runClaude } from '../../../src/watch/claude';
import { ticketOutcomeOf } from '../../../src/watch/outcome';
import { handBackReport } from '../../../src/watch/report/handBack';
import { fakeTracker, job } from '../fakeTracker';

// Real ticket runs of Claude Code 2.1.296, recorded for the step reader's tests.
const recording = (name: string) =>
  fileURLToPath(
    new URL(
      `../../../../../packages/shared/test/fixtures/stream-json/${name}.jsonl`,
      import.meta.url,
    ),
  );

async function replay(name: string, code: number) {
  const steps: RunStepInput[] = [];
  const read = createStepReader('/work/app');
  let window = '';
  const command = {
    command: '/bin/sh',
    args: ['-c', 'cat "$0"; exit "$1"', recording(name), `${code}`],
    cwd: '/',
  };
  const exit = await runClaude(command, 'fix MOB-1', new AbortController().signal, {
    onOutput: (text) => (window += text),
    onEvent: (event) => steps.push(...read(event)),
  });
  return {
    exit,
    steps: steps.map(({ kind, label }) => `${kind}: ${label.split('\n')[0]}`),
    window,
  };
}

async function handBack(texts: string[]) {
  const tracker = fakeTracker([]);
  const deps = { api: tracker.api, log: () => undefined, describe: String };
  await handBackReport(deps, job('r-1', 'MOB-1'), texts);
  return tracker.reports;
}

describe('a recorded ticket run', () => {
  it('shows each call while Claude works and hands the report back at the end', async () => {
    const { exit, steps, window } = await replay('ticket-run', 0);
    expect(steps).toEqual([
      'tool: Read src/greet.ts',
      'tool: Edit src/greet.ts',
      'tool: Run npm test',
      'text: The typo is fixed. `npm test` ran and passed.',
    ]);
    expect(window).not.toContain('"type"');
    expect(ticketOutcomeOf(exit, false)).toEqual({ status: 'done' });
    const [report] = await handBack(exit.results.map(({ text }) => text));
    expect(report?.text).toMatch(/^TICKET: MOB-1\nSTATUS: done\nSUMMARY: Changed "Helo"/);
    expect(report?.text).toMatch(/NEXT: .*$/);
  });

  it("fails with Claude Code's reason when the run reaches its turn limit", async () => {
    const { exit, steps, window } = await replay('max-turns', 1);
    expect(steps).toEqual(['tool: Read src/greet.ts', 'tool: Edit src/greet.ts']);
    expect(window).toBe('Reached maximum number of turns (2)\n');
    expect(ticketOutcomeOf(exit, false)).toEqual({
      status: 'failed',
      error: 'Claude Code exited with 1.\nReached maximum number of turns (2)',
    });
    expect(await handBack(exit.results.map(({ text }) => text))).toEqual([]);
  });
});
