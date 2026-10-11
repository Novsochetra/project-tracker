import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { listItem, makeTicketDetail, STATUS } from '../../src/api/test/fixtures';
import { DARA, makeRun, makeRunner } from '../../src/api/test/runFixtures';
import { renderTicket } from '../../src/features/ticket/test/renderTicket';
import { CLICK_SHIELD_MS } from '../../src/lib/clickShield';
import { skipAnimations, tap } from '../../src/overlays/testing';
import { advance, stillClock } from './stillClock';

// Run in Claude Code closes its sheet as soon as the run starts, and a closing sheet takes no taps,
// so the second tap of a double tap, 150 ms later, landed on the ticket screen under it: the comment
// box or the description, which opened the keyboard, or with a long description the bottom bar's
// Send to Claude, which opened the sheet again (WebKit, 375×812 and 320×568). On desktop the second
// click of a double-click focused the description.

let cleanups: Array<() => void> = [];

beforeEach(() => {
  localStorage.clear();
  cleanups = [skipAnimations()];
});

afterEach(() => cleanups.reverse().forEach((undo) => undo()));

function renderWithHelper(phone: boolean) {
  const detail = makeTicketDetail(listItem(1, STATUS.progress, 0));
  const rendered = renderTicket({
    detail,
    phone,
    client: {
      getTicketPrompt: vi.fn().mockResolvedValue({ text: 'Please work', ticketCount: 1 }),
      listRunners: vi.fn().mockResolvedValue([makeRunner()]),
      listTicketRuns: vi.fn().mockResolvedValue([]),
      startRun: vi.fn().mockResolvedValue(makeRun()),
    },
  });
  cleanups.push(rendered.restorePhone);
  return rendered;
}

const sheetRequest = () => screen.getByRole('status', { name: 'Sheet' });

async function runFromSheet(open: () => Promise<void>, press: (run: Element) => Promise<void>) {
  await open();
  const dialog = await screen.findByRole('dialog', { name: 'Send to Claude Code' });
  const run = await within(dialog).findByRole('button', { name: 'Run in Claude Code' });
  cleanups.push(stillClock());
  await press(run);
  expect(await screen.findByText(`Sent to Claude on ${DARA}`)).toBeInTheDocument();
  expect(sheetRequest()).toBeEmptyDOMElement();
}

it("drops a phone's second tap on the screen the closing sheet uncovers", async () => {
  const user = userEvent.setup();
  const { client } = renderWithHelper(true);
  const send = () =>
    within(document.querySelector<HTMLElement>('[data-bottom-bar]')!).getByRole('button', {
      name: 'Send to Claude',
    });
  await runFromSheet(
    () => user.click(send()),
    (run) => tap(user, run),
  );

  await tap(user, send());
  await tap(user, screen.getByLabelText('Description'));
  expect(sheetRequest()).toBeEmptyDOMElement();
  expect(screen.getByLabelText('Description')).not.toHaveFocus();
  expect(client.startRun).toHaveBeenCalledTimes(1);

  await advance(CLICK_SHIELD_MS);
  await tap(user, send());
  expect(sheetRequest()).toHaveTextContent('"type":"prompt"');
});

it("drops a double-click's second click on desktop", async () => {
  const user = userEvent.setup();
  renderWithHelper(false);
  const send = () => screen.getByRole('button', { name: 'Send to Claude Code' });
  await runFromSheet(
    () => user.click(send()),
    (run) => user.click(run),
  );

  expect(fireEvent.mouseDown(screen.getByLabelText('Description'), { detail: 2 })).toBe(false);
  fireEvent.click(send(), { detail: 2 });
  await advance(50);
  expect(sheetRequest()).toBeEmptyDOMElement();
});
