import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ChatDetail, RunTodo } from '@tracker/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { refreshRunSteps } from '../../api/live/refreshRunSteps';
import { makeAskRun, makeChatDetail, makeMessage } from '../../api/test/chatFixtures';
import { makeRunner } from '../../api/test/runFixtures';
import { makeStep } from '../steps/testSteps';
import { TODO_LIST_LABEL } from '../todos/todoCopy';
import { WORKING_LABEL } from './copy';
import { renderAsk } from './test/renderAsk';

const working = makeAskRun({ status: 'running', startedAt: Date.now() });
const question = makeMessage({ text: 'Fix the crash' });
const TODO_STEP = 'Update the to-do list';

const listed = (todos: RunTodo[], seq: number) => makeStep(seq, { label: TODO_STEP, todos });
const planned: RunTodo[] = [
  { text: 'Find the crash', status: 'in_progress' },
  { text: 'Fix it', status: 'pending' },
];
const halfway: RunTodo[] = [
  { text: 'Find the crash', status: 'completed' },
  { text: 'Fix it', status: 'in_progress' },
];

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

const listIn = (element: HTMLElement, name: string) =>
  within(within(element).getByRole('list', { name }))
    .getAllByRole('listitem')
    .map((item) => item.textContent);

describe("Ask: Claude's to-do list", () => {
  it('shows the latest list while Claude works, ticked live, without the calls that wrote it', async () => {
    const listRunSteps = vi
      .fn()
      .mockResolvedValueOnce([listed(planned, 1), makeStep(2)])
      .mockResolvedValue([listed(halfway, 3)]);
    const { queryClient } = setup(
      makeChatDetail({ messages: [question], run: working }),
      listRunSteps,
    );
    const message = await screen.findByRole('article', { name: WORKING_LABEL });

    expect(listIn(message, TODO_LIST_LABEL)).toEqual([
      'Find the crash, doing now',
      'Fix it, to do',
    ]);
    expect(listIn(message, "Claude's steps")).toEqual(['Read apps/web/src/file2.ts']);

    act(() => void refreshRunSteps(queryClient, working.id));
    await waitFor(() =>
      expect(listIn(message, TODO_LIST_LABEL)).toEqual([
        'Find the crash, done',
        'Fix it, doing now',
      ]),
    );
    expect(within(message).queryByText(TODO_STEP)).not.toBeInTheDocument();
  });

  it('shows the calls as steps when Claude emptied its list', async () => {
    const listRunSteps = vi.fn().mockResolvedValue([listed(planned, 1), listed([], 2)]);
    setup(makeChatDetail({ messages: [question], run: working }), listRunSteps);
    const message = await screen.findByRole('article', { name: WORKING_LABEL });
    expect(within(message).queryByRole('list', { name: TODO_LIST_LABEL })).not.toBeInTheDocument();
    expect(listIn(message, "Claude's steps")).toEqual([TODO_STEP, TODO_STEP]);
  });

  it('keeps the last list on the answer, folded', async () => {
    const answer = makeMessage({
      id: 'm-2',
      role: 'claude',
      text: 'Fixed.',
      runId: 'r-old',
      stepCount: 3,
      todos: halfway,
    });
    setup(makeChatDetail({ messages: [question, answer] }), vi.fn());
    const user = userEvent.setup();
    const claude = await screen.findByRole('article', { name: 'Claude' });
    const toggle = within(claude).getByRole('button', { name: 'To-do list, 1 of 2 done' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);
    expect(listIn(claude, TODO_LIST_LABEL)).toEqual(['Find the crash, done', 'Fix it, doing now']);
  });
});
