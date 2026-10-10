import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ChatDetail, RunStep } from '@tracker/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { refreshRunSteps } from '../../api/live/refreshRunSteps';
import { makeAskRun, makeChatDetail, makeMessage } from '../../api/test/chatFixtures';
import { makeRunner } from '../../api/test/runFixtures';
import { makeStep, makeSteps } from '../steps/testSteps';
import { queryKeys } from '../../api/queryKeys';
import { STOPPED_STEPS_LABEL, STOPPED_PART_WAY_TEXT, WORKING_LABEL } from './copy';
import { renderAsk } from './test/renderAsk';

const working = makeAskRun({ status: 'running', startedAt: Date.now() });
const question = makeMessage({ text: 'Where are runs queued?' });

let restore: () => void;

beforeEach(() => localStorage.clear());
afterEach(() => restore());

function setup(detail: ChatDetail | ChatDetail[], listRunSteps: ReturnType<typeof vi.fn>) {
  const details = [detail].flat();
  const getChat = vi.fn();
  details.forEach((each) => getChat.mockResolvedValueOnce(each));
  getChat.mockResolvedValue(details.at(-1));
  const rendered = renderAsk({
    client: {
      getChat,
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

  it('folds the steps of an answer, and opens them without its own words', async () => {
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
    expect(stepsIn(claude)).toEqual(['Read apps/web/src/file22.ts']);
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

  it('folds what Claude did before a question stopped, where the working message was', async () => {
    const stopped = makeAskRun({
      status: 'cancelled',
      startedAt: Date.now(),
      endedAt: Date.now(),
      askOptions: { model: 'default', mode: 'edit' },
      stepCount: 4,
    });
    const listRunSteps = vi.fn().mockResolvedValue(makeSteps(4));
    setup(makeChatDetail({ messages: [question], run: stopped }), listRunSteps);
    const user = userEvent.setup();
    expect(await screen.findByText(STOPPED_PART_WAY_TEXT)).toBeVisible();
    const claude = screen.getByRole('article', { name: STOPPED_STEPS_LABEL });
    await user.click(within(claude).getByRole('button', { name: '4 steps' }));
    await waitFor(() => expect(stepsIn(claude)).toHaveLength(4));
    expect(listRunSteps).toHaveBeenCalledWith(stopped.id, { after: 0 });
  });

  it('shows nothing for a question that stopped before any step', async () => {
    const stopped = makeAskRun({ status: 'failed', error: 'Lost.', endedAt: Date.now() });
    setup(makeChatDetail({ messages: [question], run: stopped }), vi.fn());
    await screen.findByText('Claude stopped: Lost.');
    expect(screen.queryByRole('article', { name: STOPPED_STEPS_LABEL })).not.toBeInTheDocument();
  });

  it.each([
    ['the answer lands', 'Claude'],
    ['the question stops', STOPPED_STEPS_LABEL],
  ])('hands focus on its steps to the folded toggle when %s', async (_when, name) => {
    const answer = makeMessage({
      id: 'm-2',
      role: 'claude',
      text: 'In runQueue.ts.',
      runId: working.id,
      stepCount: 8,
    });
    const ended =
      name === 'Claude'
        ? makeChatDetail({
            messages: [question, answer],
            run: { ...working, status: 'done', stepCount: 8 },
          })
        : makeChatDetail({
            messages: [question],
            run: { ...working, status: 'cancelled', stepCount: 8 },
          });
    const listRunSteps = vi.fn().mockResolvedValue(makeSteps(8));
    const { queryClient } = setup(
      [makeChatDetail({ messages: [question], run: working }), ended],
      listRunSteps,
    );
    const earlier = within(await workingMessage()).getByRole('button', { name: '3 earlier steps' });
    earlier.focus();

    await act(() => queryClient.invalidateQueries({ queryKey: queryKeys.chat('c-1') }));
    const toggle = await within(await screen.findByRole('article', { name })).findByRole('button', {
      name: '8 steps',
    });
    expect(toggle).toHaveFocus();
  });

  it('keeps a stopped question’s steps in its place once the person asks again', async () => {
    const first = makeMessage({ id: 'm-1', text: 'Rename the queue', createdAt: 1_000 });
    const again = makeMessage({ id: 'm-3', text: 'Try again', createdAt: 5_000 });
    const stopped = makeAskRun({
      id: 'r-stopped',
      status: 'cancelled',
      createdAt: 1_000,
      endedAt: 2_000,
      stepCount: 3,
    });
    const asking = makeAskRun({ id: 'r-again', status: 'queued', createdAt: 5_000 });
    const detail = makeChatDetail({
      messages: [first, again],
      run: asking,
      stoppedRuns: [stopped],
    });
    setup(detail, vi.fn().mockResolvedValue([]));
    const tile = await screen.findByRole('article', { name: STOPPED_STEPS_LABEL });
    expect(within(tile).getByRole('button', { name: '3 steps' })).toBeVisible();
    const order = screen
      .getAllByRole('article')
      .map((article) => article.getAttribute('aria-label'));
    expect(order).toEqual(['You', STOPPED_STEPS_LABEL, 'You']);
  });
});
