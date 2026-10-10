import { ApiError } from '@tracker/client';
import { RUN_STEPS_BATCH_MAX, RUN_STEPS_KEPT, type RunStepInput } from '@tracker/shared';
import { describe, expect, it, vi } from 'vitest';
import { createStepBatcher } from '../../../src/watch/steps/stepBatcher';

const NEVER = 1_000_000;

const steps = (count: number, from = 1): RunStepInput[] =>
  Array.from({ length: count }, (_, index) => ({
    kind: 'tool',
    label: `Read ${from + index}.ts`,
    subAgent: false,
    toolId: null,
  }));

function batcher(send: (batch: RunStepInput[]) => Promise<void>, every = NEVER) {
  const log: string[] = [];
  const sent: RunStepInput[][] = [];
  const batches = createStepBatcher({
    send: async (batch) => {
      sent.push(batch);
      await send(batch);
    },
    log: (text) => log.push(text),
    describe: (error) => (error as Error).message,
    every,
  });
  return { batches, sent, log };
}

const ok = () => Promise.resolve();

describe('createStepBatcher', () => {
  it('sends the steps of each round together, about once a round', async () => {
    const { batches, sent } = batcher(ok, 20);
    batches.add(steps(2));
    batches.add(steps(1, 3));
    await vi.waitFor(() => expect(sent).toEqual([steps(3)]));
    batches.add(steps(1, 4));
    await vi.waitFor(() => expect(sent).toEqual([steps(3), steps(1, 4)]));
    await batches.end();
  });

  it('sends what is left when the run ends, then nothing more', async () => {
    const { batches, sent } = batcher(ok);
    batches.add(steps(RUN_STEPS_BATCH_MAX + 1));
    await batches.end();
    expect(sent).toEqual([steps(RUN_STEPS_BATCH_MAX), steps(1, RUN_STEPS_BATCH_MAX + 1)]);
    batches.add(steps(1));
    await batches.end();
    expect(sent).toHaveLength(2);
  });

  it('waits for a send under way before it sends the rest, so steps keep their order', async () => {
    let release = () => undefined as void;
    const first = new Promise<void>((resolve) => (release = resolve));
    const { batches, sent } = batcher(
      (batch) => (batch[0]?.label === 'Read 1.ts' ? first : ok()),
      10,
    );
    batches.add(steps(1));
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    batches.add(steps(1, 2));
    const ending = batches.end();
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(sent).toHaveLength(1);
    release();
    await ending;
    expect(sent).toEqual([steps(1), steps(1, 2)]);
  });

  it('keeps only the newest steps while it cannot send', async () => {
    const { batches, sent } = batcher(ok);
    batches.add(steps(RUN_STEPS_KEPT + 5));
    await batches.end();
    expect(sent.flat()).toEqual(steps(RUN_STEPS_KEPT, 6));
  });

  it('drops a batch that fails, says so once, and goes on with the next', async () => {
    let fail = true;
    const { batches, sent, log } = batcher(
      () => (fail ? Promise.reject(new Error('fetch failed')) : ok()),
      20,
    );
    batches.add(steps(1));
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    batches.add(steps(1, 2));
    await vi.waitFor(() => expect(sent).toHaveLength(2));
    fail = false;
    batches.add(steps(1, 3));
    await batches.end();
    expect(sent.at(-1)).toEqual(steps(1, 3));
    expect(log).toEqual(["Couldn't show the tracker what Claude is doing: fetch failed"]);
  });

  it('stops quietly once the tracker says the run ended', async () => {
    const ended = new ApiError(409, 'conflict', 'This run already ended (cancelled).');
    const { batches, sent, log } = batcher(() => Promise.reject(ended));
    batches.add(steps(RUN_STEPS_BATCH_MAX * 2));
    await batches.end();
    expect(sent).toHaveLength(1);
    expect(log).toEqual([]);
  });

  it('goes on after steps the tracker refuses as invalid', async () => {
    const invalid = new ApiError(400, 'invalid_input', 'Give every step a label.');
    let fail = true;
    const { batches, sent, log } = batcher(() => (fail ? Promise.reject(invalid) : ok()), 10);
    batches.add(steps(1));
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    fail = false;
    batches.add(steps(1, 2));
    await batches.end();
    expect(sent).toEqual([steps(1), steps(1, 2)]);
    expect(log).toEqual([
      "Couldn't show the tracker what Claude is doing: Give every step a label.",
    ]);
  });

  it('stops after a tracker that has no steps route, and says so', async () => {
    const missing = new ApiError(404, 'not_found', 'Not found.');
    const { batches, sent, log } = batcher(() => Promise.reject(missing), 10);
    batches.add(steps(1));
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    batches.add(steps(1, 2));
    await batches.end();
    expect(sent).toHaveLength(1);
    expect(log).toEqual(["Couldn't show the tracker what Claude is doing: Not found."]);
  });
});
