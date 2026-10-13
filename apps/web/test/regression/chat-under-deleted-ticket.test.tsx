import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '@tracker/client';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { makeChatDetail } from '../../src/api/test/chatFixtures';
import { project } from '../../src/api/test/fixtures';
import { setupApi } from '../../src/api/test/render';
import { makeRunner } from '../../src/api/test/runFixtures';
import { SheetsContext } from '../../src/app/sheets/context';
import { currentPath, fakeSheets } from '../../src/app/test/harness';
import { LocationProbe } from '../../src/app/test/LocationProbe';
import { ToastProvider } from '../../src/components';
import { ChatScreen } from '../../src/features/ask/ChatScreen';
import { TicketScreen } from '../../src/features/ticket/TicketScreen';
import { routePath, StackNavigator, type Route } from '../../src/navigation';
import { mockPhone, skipAnimations } from '../../src/overlays/testing';

// A chat opened from a ticket sits above that ticket's screen. Once the ticket was deleted, the
// hidden ticket screen under the chat took its 404 and replaced the whole stack with the project,
// so the chat, which the delete keeps, could not be read (PT-184).

function screenFor(route: Route): ReactNode {
  if (route.name === 'ticket') return <TicketScreen projectKey={route.key} num={route.num} />;
  if (route.name === 'chat') {
    return <ChatScreen projectKey={route.key} chatId={route.chatId} ticketNum={route.ticketNum} />;
  }
  return <p>{routePath(route)}</p>;
}

let undo: Array<() => void> = [];

beforeEach(() => {
  undo = [skipAnimations(), mockPhone(true)];
});

afterEach(() => undo.forEach((restore) => restore()));

it('keeps a chat on screen when the ticket it was opened from is gone, and Back leaves it', async () => {
  const api = setupApi({
    getProject: vi.fn().mockResolvedValue({ project, statuses: [] }),
    getTicket: vi.fn().mockRejectedValue(new ApiError(404, 'not_found', 'Ticket MOB-3 not found')),
    getChat: vi.fn().mockResolvedValue(makeChatDetail()),
    listRunners: vi.fn().mockResolvedValue([makeRunner()]),
  });
  const ApiWrapper = api.wrapper;
  render(
    <MemoryRouter initialEntries={['/p/MOB/3/ask/c-1']}>
      <ApiWrapper>
        <ToastProvider>
          <SheetsContext.Provider value={fakeSheets()}>
            <StackNavigator renderScreen={screenFor} />
            <LocationProbe />
          </SheetsContext.Provider>
        </ToastProvider>
      </ApiWrapper>
    </MemoryRouter>,
  );
  expect(await screen.findByRole('list', { name: 'Messages' })).toBeInTheDocument();
  await waitFor(() => expect(api.client.getTicket).toHaveBeenCalled());
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(currentPath()).toBe('/p/MOB/3/ask/c-1');

  await userEvent.setup().click(screen.getByRole('button', { name: 'Back to MOB-3' }));
  await waitFor(() => expect(currentPath()).toBe('/p/MOB'));
});
