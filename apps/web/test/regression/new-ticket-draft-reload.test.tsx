import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '@tracker/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { queryKeys } from '../../src/api';
import { listItem, makeBoard, STATUS } from '../../src/api/test/fixtures';
import { setupApi } from '../../src/api/test/render';
import { useSheets } from '../../src/app/sheets/context';
import { SheetsProvider } from '../../src/app/sheets/SheetsProvider';
import { ToastProvider } from '../../src/components';
import { sheetTestSetup } from '../../src/features/claude/test/renderWithApi';

// Text typed in the New ticket sheet lived only in the sheet, so an app update, a crash or iOS
// stopping the app threw it away (PT-11).

const TITLE = 'Offline mode for quick capture';
const DESCRIPTION = 'Keep captures in a queue';

const {
  commentCount: _c,
  attachmentCount: _a,
  ...created
} = listItem(5, STATUS.todo, -1, {
  title: TITLE,
});

function Opener({ projectKey }: { projectKey: string }) {
  const sheets = useSheets();
  return (
    <button type="button" onClick={() => sheets.open({ type: 'newTicket', projectKey })}>
      New ticket in {projectKey}
    </button>
  );
}

// Each call is a fresh page load: new API cache and sheet host, the same storage.
function loadApp(createTicket = vi.fn().mockResolvedValue(created)) {
  const api = setupApi({
    createTicket,
    getBoard: vi.fn().mockResolvedValue(makeBoard()),
    listPeople: vi.fn().mockResolvedValue([]),
  });
  api.queryClient.setQueryData(queryKeys.board('MOB'), makeBoard());
  const Wrapper = api.wrapper;
  render(
    <Wrapper>
      <ToastProvider>
        <SheetsProvider>
          <Opener projectKey="MOB" />
          <Opener projectKey="WEB" />
        </SheetsProvider>
      </ToastProvider>
    </Wrapper>,
  );
  return { createTicket, user: userEvent.setup() };
}

function reload() {
  cleanup();
  return loadApp();
}

const sheet = () => screen.getByRole('dialog', { name: 'New ticket' });
const title = () => within(sheet()).getByLabelText('Ticket title');
const description = () => within(sheet()).getByLabelText('Description');
const priority = () => within(sheet()).getByRole('button', { name: /^Priority/ });
const sheetClosed = () =>
  waitFor(() =>
    expect(screen.queryByRole('dialog', { name: 'New ticket' })).not.toBeInTheDocument(),
  );

async function typeIdea(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'New ticket in MOB' }));
  await user.type(title(), TITLE);
  await user.type(description(), DESCRIPTION);
  await user.click(priority());
  await user.click(screen.getByRole('option', { name: 'High' }));
}

let restore: () => void = () => undefined;

beforeEach(() => {
  restore = sheetTestSetup(true);
});

afterEach(() => {
  restore();
  localStorage.clear();
});

describe('regression: the New ticket sheet keeps typed text across a reload', () => {
  it('opens again with what was typed, for that project only, until the ticket is created', async () => {
    const first = loadApp();
    await typeIdea(first.user);

    const { user, createTicket } = reload();
    await user.click(screen.getByRole('button', { name: 'New ticket in WEB' }));
    expect(title()).toHaveValue('');
    await user.click(within(sheet()).getByRole('button', { name: 'Cancel' }));
    await sheetClosed();
    await user.click(screen.getByRole('button', { name: 'New ticket in MOB' }));
    expect(title()).toHaveValue(TITLE);
    expect(description()).toHaveValue(DESCRIPTION);
    expect(priority()).toHaveTextContent('High');

    await user.type(title(), '{Enter}');
    expect(createTicket).toHaveBeenCalledWith(
      'MOB',
      expect.objectContaining({ title: TITLE, description: DESCRIPTION, priority: 'high' }),
    );
    expect(await screen.findByText('MOB-5 created')).toBeInTheDocument();

    const after = reload();
    await after.user.click(screen.getByRole('button', { name: 'New ticket in MOB' }));
    expect(title()).toHaveValue('');
  });

  it('keeps the text through a failed create, and lets it go once discarded', async () => {
    const failing = vi.fn().mockRejectedValue(new ApiError(503, 'http_error', 'Bad gateway'));
    const first = loadApp(failing);
    await typeIdea(first.user);
    await first.user.type(title(), '{Enter}');
    expect(await within(sheet()).findByRole('alert')).toHaveTextContent("Can't reach the tracker.");

    const { user } = reload();
    await user.click(screen.getByRole('button', { name: 'New ticket in MOB' }));
    expect(title()).toHaveValue(TITLE);
    await user.click(within(sheet()).getByRole('button', { name: 'Cancel' }));
    await user.click(screen.getByRole('button', { name: 'Discard changes' }));
    await sheetClosed();

    const after = reload();
    await after.user.click(screen.getByRole('button', { name: 'New ticket in MOB' }));
    expect(title()).toHaveValue('');
  });
});
