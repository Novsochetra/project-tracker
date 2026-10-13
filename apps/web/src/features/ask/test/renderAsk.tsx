import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { vi } from 'vitest';
import { project } from '../../../api/test/fixtures';
import { setupApi } from '../../../api/test/render';
import { fakeSheets } from '../../../app/test/harness';
import { SheetsContext } from '../../../app/sheets/context';
import { ToastProvider } from '../../../components';
import { routePath, StackNavigator, type Route } from '../../../navigation';
import { mockPhone, skipAnimations } from '../../../overlays/testing';
import { LocationProbe } from '../../project/test/LocationProbe';
import { ChatScreen } from '../ChatScreen';
import { ChatsScreen } from '../ChatsScreen';

type ClientOverrides = Parameters<typeof setupApi>[0];

export interface RenderAskOptions {
  path?: string;
  phone?: boolean;
  client?: ClientOverrides;
}

function screenFor(route: Route): ReactNode {
  if (route.name === 'chats') return <ChatsScreen projectKey={route.key} />;
  if (route.name === 'chat') {
    return <ChatScreen projectKey={route.key} chatId={route.chatId} ticketNum={route.ticketNum} />;
  }
  return <p>{routePath(route)}</p>;
}

export function renderAsk({
  path = '/p/MOB/ask/c-1',
  phone = false,
  client,
}: RenderAskOptions = {}) {
  const undo = [skipAnimations(), mockPhone(phone)];
  const api = setupApi({
    getProject: vi.fn().mockResolvedValue({ project, statuses: [] }),
    ...client,
  });
  const sheets = fakeSheets();
  const ApiWrapper = api.wrapper;
  const view = render(
    <MemoryRouter initialEntries={[path]}>
      <ApiWrapper>
        <ToastProvider>
          <SheetsContext.Provider value={sheets}>
            <StackNavigator renderScreen={screenFor} />
            <LocationProbe />
          </SheetsContext.Provider>
        </ToastProvider>
      </ApiWrapper>
    </MemoryRouter>,
  );
  return { ...api, sheets, view, restore: () => undo.forEach((restore) => restore()) };
}
