import type { ProjectSummary } from '@tracker/shared';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { vi, type Mock } from 'vitest';
import { queryKeys } from '../../api';
import { project, summaryOf } from '../../api/test/fixtures';
import { setupApi } from '../../api/test/render';
import { ToastProvider } from '../../components';
import { NavigationProvider } from '../../navigation';
import { SheetsContext, type SheetsApi } from '../sheets/context';
import type { SheetRequest } from '../sheets/types';
import { LocationProbe } from './LocationProbe';

export type FakeSheets = SheetsApi & { open: Mock<(request: SheetRequest) => void> };

export const fakeSheets = (): FakeSheets => ({ open: vi.fn(), close: vi.fn(), current: null });

export const projectSummary = (overrides: Partial<ProjectSummary> = {}): ProjectSummary => ({
  ...summaryOf(project),
  ...overrides,
});

export const currentPath = (): string | null =>
  screen.getByRole('status', { name: 'Location' }).textContent;

export interface HarnessOptions {
  path?: string;
  client?: Parameters<typeof setupApi>[0];
  projects?: ProjectSummary[];
  sheets?: FakeSheets;
}

export function renderWithApp(ui: ReactNode, options: HarnessOptions = {}) {
  const { path = '/', client = {}, projects, sheets = fakeSheets() } = options;
  const api = setupApi(client);
  if (projects) api.queryClient.setQueryData(queryKeys.projects(), projects);
  const Wrapper = api.wrapper;
  const result = render(
    <Wrapper>
      <ToastProvider>
        <MemoryRouter initialEntries={[path]}>
          <NavigationProvider>
            <SheetsContext.Provider value={sheets}>
              {ui}
              <LocationProbe />
            </SheetsContext.Provider>
          </NavigationProvider>
        </MemoryRouter>
      </ToastProvider>
    </Wrapper>,
  );
  return { ...api, ...result, sheets };
}
