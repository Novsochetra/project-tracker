import { fireEvent, screen } from '@testing-library/react';
import { RUN_PROMPT_MAX } from '@tracker/shared';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { listItem, makeTicketDetail, STATUS } from '../../src/api/test/fixtures';
import { makeRun, makeRunner } from '../../src/api/test/runFixtures';
import { PromptSheet } from '../../src/features/claude/PromptSheet';
import { renderWithApi, sheetTestSetup } from '../../src/features/claude/test/renderWithApi';

let restore: () => void;

beforeEach(() => {
  localStorage.clear();
  restore = sheetTestSetup();
});

afterEach(() => restore());

// PT-220: a ticket with long label instructions built a prompt over the 100,000 characters a run
// takes, and Run in Claude Code was refused with no clear reason.
it('says a prompt is too long to run and keeps Run off until it is shorter', async () => {
  const detail = makeTicketDetail(listItem(1, STATUS.todo, 0));
  const text = 'x'.repeat(RUN_PROMPT_MAX + 1);
  const startRun = vi.fn(() => Promise.resolve(makeRun()));
  renderWithApi(
    <PromptSheet open onClose={() => undefined} scope={{ kind: 'ticket', ticketKey: 'MOB-1' }} />,
    {
      getTicketPrompt: vi.fn().mockResolvedValue({ text, ticketCount: 1, role: 'work' }),
      getTicket: vi.fn().mockResolvedValue(detail),
      listRunners: vi.fn().mockResolvedValue([makeRunner()]),
      listTicketRuns: vi.fn().mockResolvedValue([]),
      startRun,
    },
  );
  const run = await screen.findByRole('button', { name: 'Run in Claude Code' });

  expect(run).toBeDisabled();
  expect(screen.getByRole('alert')).toHaveTextContent(
    'A run takes a prompt of up to 100,000 characters. This one has 100,001: shorten it to run it, or copy it.',
  );
  expect(screen.getByRole('button', { name: 'Copy prompt' })).toBeEnabled();

  fireEvent.change(screen.getByRole('textbox', { name: 'Prompt for Claude Code' }), {
    target: { value: text.slice(1) },
  });
  expect(run).toBeEnabled();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
