import { screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  makeAskRun,
  makeChatDetail,
  makeMessage,
  ticketCardText,
} from '../../src/api/test/chatFixtures';
import { listItem, makeTicketDetail, STATUS } from '../../src/api/test/fixtures';
import { makeRunner } from '../../src/api/test/runFixtures';
import { renderAsk } from '../../src/features/ask/test/renderAsk';

let restore: () => void;

beforeEach(() => localStorage.clear());
afterEach(() => restore());

// A helper answers a question and runs a ticket side by side, so a question being answered must
// not take the created card's Run away (PT-156 review).
describe('regression: Run on a created card while Claude thinks', () => {
  it('stays offered', async () => {
    const detail = makeChatDetail({
      messages: [
        makeMessage({
          id: 'm-1',
          role: 'claude',
          text: ticketCardText('Faster sync'),
          cardTickets: [{ index: 0, ticketKey: 'MOB-7' }],
        }),
        makeMessage({ id: 'm-2', text: 'And the tests?' }),
      ],
      run: makeAskRun({ status: 'running', startedAt: Date.now() }),
    });
    restore = renderAsk({
      client: {
        getChat: vi.fn().mockResolvedValue(detail),
        listRunners: vi.fn().mockResolvedValue([makeRunner()]),
        getTicket: vi
          .fn()
          .mockResolvedValue(
            makeTicketDetail(listItem(7, STATUS.todo, 0, { title: 'Faster sync' })),
          ),
        listTicketRuns: vi.fn().mockResolvedValue([]),
      },
    }).restore;
    expect(await screen.findByText(/Claude is thinking on/)).toBeVisible();
    expect(await screen.findByRole('button', { name: 'Run MOB-7 in Claude Code' })).toBeVisible();
  });
});
