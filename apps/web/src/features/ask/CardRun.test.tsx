import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RUN_PROMPT_MAX } from '@tracker/shared';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { makeRunner } from '../../api/test/runFixtures';
import { renderWithApi, sheetTestSetup } from '../claude/test/renderWithApi';
import { CardRun } from './CardRun';

let restore: () => void;

beforeEach(() => {
  restore = sheetTestSetup();
});

afterEach(() => restore());

it('says a prompt is too long to run here and where to shorten it', async () => {
  const startRun = vi.fn();
  renderWithApi(<CardRun ticketKey="MOB-1" helper={makeRunner()} />, {
    getTicketPrompt: vi.fn().mockResolvedValue({
      text: 'x'.repeat(RUN_PROMPT_MAX + 5_000),
      ticketCount: 1,
      role: 'work',
    }),
    listTicketRuns: vi.fn().mockResolvedValue([]),
    startRun,
  });
  await userEvent.setup().click(screen.getByRole('button', { name: 'Run MOB-1 in Claude Code' }));

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'A run takes a prompt of up to 100,000 characters. This ticket’s prompt has 105,000: open the ticket to shorten it and run it from there.',
  );
  expect(startRun).not.toHaveBeenCalled();
});
