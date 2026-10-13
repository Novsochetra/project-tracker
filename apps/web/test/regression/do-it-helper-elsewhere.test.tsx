import { screen } from '@testing-library/react';
import type { ChatDetail, Runner } from '@tracker/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeAskRun, makeChat, makeChatDetail, makeMessage } from '../../src/api/test/chatFixtures';
import { DARA, makeRunner } from '../../src/api/test/runFixtures';
import { renderAsk } from '../../src/features/ask/test/renderAsk';

const options = { model: 'opus', mode: 'plan', effort: 'high' } as const;
const run = makeAskRun({ status: 'done', endedAt: Date.now(), askOptions: options });
const planned: ChatDetail = makeChatDetail({
  chat: makeChat({ options }),
  messages: [
    makeMessage({ text: 'Plan a faster sync' }),
    makeMessage({ id: 'm-2', role: 'claude', text: '1. Batch.', runId: run.id }),
  ],
  run,
});

let restore: () => void;

beforeEach(() => localStorage.clear());
afterEach(() => restore());

function showWith(runners: Runner[]) {
  restore = renderAsk({
    client: {
      getChat: vi.fn().mockResolvedValue(planned),
      listRunners: vi.fn().mockResolvedValue(runners),
    },
  }).restore;
}

// PT-211: a helper that was online but no longer ran this project was called offline.
describe('Do it without the helper that made the plan', () => {
  it('says the helper no longer runs the project when it is online elsewhere', async () => {
    showWith([makeRunner({ projectKeys: ['WEB'] })]);
    expect(
      await screen.findByText(`Do it needs ${DARA}, which doesn't run MOB now.`),
    ).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Do it' })).not.toBeInTheDocument();
  });

  it('says the helper is offline only when it is', async () => {
    showWith([makeRunner({ online: false, projectKeys: ['WEB'] })]);
    expect(await screen.findByText(`Do it needs ${DARA}, which is offline.`)).toBeVisible();
  });

  it('says the helper was removed when it is gone', async () => {
    showWith([makeRunner({ id: 'h-other', name: 'Studio' })]);
    expect(await screen.findByText(`Do it needs ${DARA}, which was removed.`)).toBeVisible();
  });
});
