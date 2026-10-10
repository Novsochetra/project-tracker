import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { RunRequest } from '@tracker/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { refreshRunRequests } from '../../api/live/refreshForRun';
import { makeAskRun, makeChatDetail, makeMessage } from '../../api/test/chatFixtures';
import { makeQuestionRequest, makeRequest } from '../../api/test/requestFixtures';
import { DARA, makeRunner } from '../../api/test/runFixtures';
import { makeSteps } from '../steps/testSteps';
import { WORKING_LABEL } from './copy';
import { renderAsk } from './test/renderAsk';

const working = makeAskRun({
  status: 'running',
  startedAt: Date.now(),
  askOptions: { model: 'default', mode: 'edit' },
});
const question = makeMessage({ text: 'Rename the sync queue' });

let restore: () => void;

beforeEach(() => localStorage.clear());
afterEach(() => restore());

function setup(listRunRequests: ReturnType<typeof vi.fn>, steps = makeSteps(2)) {
  const rendered = renderAsk({
    client: {
      getChat: vi.fn().mockResolvedValue(makeChatDetail({ messages: [question], run: working })),
      listRunners: vi.fn().mockResolvedValue([makeRunner()]),
      listRunSteps: vi.fn().mockResolvedValue(steps),
      listRunRequests,
      answerRunRequest: vi
        .fn()
        .mockResolvedValue(
          makeRequest({ runId: working.id, status: 'answered', decision: 'allow', endedAt: 1 }),
        ),
    },
  });
  restore = rendered.restore;
  return rendered;
}

const workingMessage = () => screen.findByRole('article', { name: WORKING_LABEL });

describe('Ask: Claude asks and waits', () => {
  it('shows the request under the steps and says Claude waits until it is answered', async () => {
    const listRunRequests = vi.fn().mockResolvedValue([makeRequest({ runId: working.id })]);
    const { client } = setup(listRunRequests);
    const user = userEvent.setup();
    const message = await workingMessage();
    const card = await within(message).findByRole('region', { name: 'Claude asks: Run npm test' });

    const steps = within(message).getByRole('list', { name: "Claude's steps" });
    expect(steps.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(listRunRequests).toHaveBeenCalledWith(working.id);
    expect(screen.getByText('Claude is waiting for your answer.')).toBeInTheDocument();
    expect(screen.queryByText(`Claude is thinking on ${DARA}…`)).not.toBeInTheDocument();

    await user.click(within(card).getByRole('button', { name: 'Allow' }));
    expect(client.answerRunRequest).toHaveBeenCalledWith('q-1', { decision: 'allow' });
    expect(await within(card).findByText('Allowed')).toBeInTheDocument();
    expect(screen.getByText(`Claude is thinking on ${DARA}…`)).toBeInTheDocument();
  });

  it('shows a request that comes before any step, and reads them again on a request event', async () => {
    const asked: RunRequest = makeQuestionRequest(undefined, { runId: working.id });
    const listRunRequests = vi.fn().mockResolvedValueOnce([]).mockResolvedValue([asked]);
    const { queryClient } = setup(listRunRequests, []);
    await waitFor(() => expect(listRunRequests).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('article', { name: WORKING_LABEL })).not.toBeInTheDocument();

    act(() => refreshRunRequests(queryClient, working.id));
    const message = await workingMessage();
    expect(
      await within(message).findByRole('region', {
        name: 'Claude asks: Which name should the queue get?',
      }),
    ).toBeInTheDocument();
    expect(within(message).queryByRole('list', { name: "Claude's steps" })).toBeNull();
  });
});
