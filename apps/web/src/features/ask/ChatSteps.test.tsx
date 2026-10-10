import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ChatDetail, RunStep } from '@tracker/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { refreshRunSteps } from '../../api/live/refreshRunSteps';
import { makeAskRun, makeChatDetail, makeMessage } from '../../api/test/chatFixtures';
import { makeRunner } from '../../api/test/runFixtures';
import { makeStep, makeSteps } from '../steps/testSteps';
import { WORKING_LABEL } from './copy';
import { renderAsk } from './test/renderAsk';

const working = makeAskRun({ status: 'running', startedAt: Date.now() });
const question = makeMessage({ text: 'Where are runs queued?' });

let restore: () => void;

beforeEach(() => localStorage.clear());
afterEach(() => restore());

function setup(detail: ChatDetail, listRunSteps: ReturnType<typeof vi.fn>) {
  const rendered = renderAsk({
    client: {
      getChat: vi.fn().mockResolvedValue(detail),
      listRunners: vi.fn().mockResolvedValue([makeRunner()]),
      listRunSteps,
    },
  });
  restore = rendered.restore;
  return rendered;
}

const workingMessage = () => screen.findByRole('article', { name: WORKING_LABEL });
const stepsIn = (element: HTMLElement) =>
  within(within(element).getByRole('list', { name: "Claude's steps" }))
    .getAllByRole('listitem')
    .map((item) => item.textContent);

describe('Ask: what Claude is doing', () => {
  it('shows the latest steps while Claude works, and the earlier ones on a tap', async () => {
    const listRunSteps = vi.fn().mockResolvedValue(makeSteps(8));
    setup(makeChatDetail({ messages: [question], run: working }), listRunSteps);
    const user = userEvent.setup();
    const message = await workingMessage();

    expect(listRunSteps).toHaveBeenCalledWith(working.id, { after: 0 });
    expect(stepsIn(message)).toEqual(
      [4, 5, 6, 7, 8].map((seq) => `Read apps/web/src/file${seq}.ts`),
    );
    await user.click(within(message).getByRole('button', { name: '3 earlier steps' }));
    expect(stepsIn(message)).toHaveLength(8);
    await user.click(within(message).getByRole('button', { name: 'Hide earlier steps' }));
    expect(stepsIn(message)).toHaveLength(5);
  });

  it('reads only the new steps when the tracker says more came', async () => {
    const listRunSteps = vi
      .fn()
      .mockResolvedValueOnce(makeSteps(2))
      .mockResolvedValue([
        makeStep(3, { kind: 'text', label: 'It is in runQueue.ts.', toolId: null }),
      ]);
    const { queryClient } = setup(
      makeChatDetail({ messages: [question], run: working }),
      listRunSteps,
    );
    const message = await workingMessage();
    expect(stepsIn(message)).toHaveLength(2);

    act(() => void refreshRunSteps(queryClient, working.id));
    await waitFor(() => expect(stepsIn(message)).toHaveLength(3));
    expect(listRunSteps).toHaveBeenLastCalledWith(working.id, { after: 2 });
    expect(stepsIn(message).at(-1)).toBe('It is in runQueue.ts.');
  });

  it("cuts Claude's earlier words to a few lines and shows its newest whole", async () => {
    const long = Array.from({ length: 9 }, (_, line) => `Line ${line + 1}.`).join('\n');
    const steps = [
      makeStep(1, { kind: 'text', label: long, toolId: null }),
      makeStep(2),
      makeStep(3, { kind: 'text', label: long, toolId: null }),
    ];
    setup(makeChatDetail({ messages: [question], run: working }), vi.fn().mockResolvedValue(steps));
    const items = within(await workingMessage()).getAllByRole('listitem');
    expect(items[0]).toHaveStyle({ '--step-lines': '3' });
    expect(items[2]?.style.getPropertyValue('--step-lines')).toBe('');
  });

  it('marks a call that was not allowed and shows why under it', async () => {
    const steps: RunStep[] = [
      makeStep(1, { label: 'Run echo hello > out.txt', toolId: 'toolu_a' }),
      makeStep(2, {
        kind: 'denied',
        label: 'Not allowed: Run echo hello > out.txt',
        toolId: 'toolu_a',
      }),
      makeStep(3, { kind: 'agent', label: 'Start sub agent: Find the queue', toolId: 'toolu_b' }),
      makeStep(4, { label: 'Read runQueue.ts', subAgent: true, toolId: 'toolu_c' }),
    ];
    setup(makeChatDetail({ messages: [question], run: working }), vi.fn().mockResolvedValue(steps));
    expect(stepsIn(await workingMessage())).toEqual([
      'Run echo hello > out.txt, Not allowed',
      'Not allowed: Run echo hello > out.txt',
      'Start sub agent: Find the queue',
      'Read runQueue.ts',
    ]);
  });

  it('shows no working message before the first step, and none once the answer lands', async () => {
    const listRunSteps = vi.fn().mockResolvedValue([]);
    setup(makeChatDetail({ messages: [question], run: working }), listRunSteps);
    await waitFor(() => expect(listRunSteps).toHaveBeenCalled());
    expect(screen.queryByRole('article', { name: WORKING_LABEL })).not.toBeInTheDocument();
    restore();

    const done = setup(makeChatDetail(), vi.fn());
    await screen.findByText('It reads the queue every minute.');
    expect(done.client.listRunSteps).not.toHaveBeenCalled();
    expect(screen.queryByRole('article', { name: WORKING_LABEL })).not.toBeInTheDocument();
  });

  it('folds the steps of an answer, and reads them when opened', async () => {
    const answer = makeMessage({
      id: 'm-2',
      role: 'claude',
      text: 'In runQueue.ts.',
      runId: 'r-old',
      stepCount: 23,
    });
    const steps = [
      makeStep(22),
      makeStep(23, { kind: 'text', label: 'In runQueue.ts.', toolId: null }),
    ];
    const listRunSteps = vi.fn().mockResolvedValue(steps);
    setup(makeChatDetail({ messages: [question, answer] }), listRunSteps);
    const user = userEvent.setup();
    const claude = await screen.findByRole('article', { name: 'Claude' });
    const toggle = within(claude).getByRole('button', { name: '23 steps' });

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(listRunSteps).not.toHaveBeenCalled();
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(listRunSteps).toHaveBeenCalledWith('r-old', { after: 0 });
    expect(await within(claude).findByText('21 earlier steps were not kept.')).toBeVisible();
    expect(stepsIn(claude)).toEqual(['Read apps/web/src/file22.ts', 'In runQueue.ts.']);
    await user.click(toggle);
    expect(within(claude).queryByRole('list')).not.toBeInTheDocument();
  });

  it('says when the steps could not be read, and reads them again', async () => {
    const answer = makeMessage({
      id: 'm-2',
      role: 'claude',
      text: 'Yes.',
      runId: 'r-old',
      stepCount: 1,
    });
    const listRunSteps = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValue([makeStep(1)]);
    setup(makeChatDetail({ messages: [question, answer] }), listRunSteps);
    const user = userEvent.setup();
    const claude = await screen.findByRole('article', { name: 'Claude' });
    await user.click(within(claude).getByRole('button', { name: '1 step' }));
    expect(await within(claude).findByText(/Couldn't load the steps/)).toBeVisible();
    await user.click(within(claude).getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(stepsIn(claude)).toEqual(['Read apps/web/src/file1.ts']));
  });

  it('leaves an answer from before steps, or with none, unfolded', async () => {
    const answers = [
      makeMessage({ id: 'm-2', role: 'claude', text: 'Before steps.', runId: null }),
      makeMessage({ id: 'm-3', role: 'claude', text: 'No steps.', runId: 'r-2', stepCount: 0 }),
    ];
    setup(makeChatDetail({ messages: [question, ...answers] }), vi.fn());
    await screen.findByText('No steps.');
    expect(screen.queryByRole('button', { name: /step/ })).not.toBeInTheDocument();
  });
});
