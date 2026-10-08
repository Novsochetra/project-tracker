import { render } from '@testing-library/react';
import type { ProjectBoard } from '@tracker/shared';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { vi } from 'vitest';
import { makeBoard } from '../../../api/test/fixtures';
import { setupApi } from '../../../api/test/render';
import { LiveRegion } from '../../../app/LiveRegion';
import { SheetsContext, type SheetsApi } from '../../../app/sheets/context';
import { ToastProvider } from '../../../components';
import { routePath, StackNavigator, type Route } from '../../../navigation';
import { ProjectScreen } from '../ProjectScreen';
import { LocationProbe } from './LocationProbe';

type ClientOverrides = Parameters<typeof setupApi>[0];

export interface RenderProjectOptions {
  path?: string;
  board?: ProjectBoard;
  client?: ClientOverrides;
}

const renderScreen = (route: Route): ReactNode =>
  route.name === 'project' ? <ProjectScreen projectKey={route.key} /> : <p>{routePath(route)}</p>;

/** The Project screen inside a real stack, with a fake API and a recording sheet host. */
export function renderProject({ path = '/p/MOB', board, client }: RenderProjectOptions = {}) {
  const api = setupApi({
    getBoard: vi.fn().mockResolvedValue(board ?? makeBoard()),
    listPeople: vi.fn().mockResolvedValue([]),
    ...client,
  });
  const sheets: SheetsApi = { open: vi.fn(), close: vi.fn(), current: null };
  const ApiWrapper = api.wrapper;
  const view = render(
    <MemoryRouter initialEntries={[path]}>
      <ApiWrapper>
        <ToastProvider>
          <SheetsContext.Provider value={sheets}>
            <StackNavigator renderScreen={renderScreen} />
            <LocationProbe />
            <LiveRegion />
          </SheetsContext.Provider>
        </ToastProvider>
      </ApiWrapper>
    </MemoryRouter>,
  );
  return { ...api, sheets, view };
}
