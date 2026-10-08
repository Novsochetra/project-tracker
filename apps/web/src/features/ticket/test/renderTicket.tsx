import { render } from '@testing-library/react';
import type { TicketDetail } from '@tracker/shared';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { vi } from 'vitest';
import { ApiProvider } from '../../../api';
import { makeTicketDetail } from '../../../api/test/fixtures';
import { seedTicket, setupApi } from '../../../api/test/render';
import { SheetsProvider } from '../../../app/sheets/SheetsProvider';
import { ToastProvider } from '../../../components';
import { NavigationProvider } from '../../../navigation';
import { mockPhone } from '../../../overlays/testing';
import { TicketScreen } from '../TicketScreen';
import { AppDrafts } from './AppDrafts';
import { Probes } from './Probes';

type ClientOverrides = Parameters<typeof setupApi>[0];

export interface RenderTicketOptions {
  detail?: TicketDetail;
  client?: ClientOverrides;
  phone?: boolean;
  seed?: boolean;
  children?: ReactNode;
}

export function renderTicket({
  detail = makeTicketDetail(),
  client: overrides = {},
  phone = false,
  seed = true,
  children,
}: RenderTicketOptions = {}) {
  const restorePhone = mockPhone(phone);
  // Refetches after a save never answer, so tests see the optimistic state they caused.
  const api = setupApi({
    getTicket: vi.fn().mockReturnValue(new Promise(() => undefined)),
    getProject: vi.fn().mockReturnValue(new Promise(() => undefined)),
    listPeople: vi.fn().mockResolvedValue(['Dara', 'Sophea']),
    ...overrides,
  });
  if (seed) seedTicket(api.queryClient, detail);
  const path = `/p/${detail.project.key}/${detail.ticket.num}`;
  const view = render(
    <MemoryRouter initialEntries={[`/p/${detail.project.key}`, path]} initialIndex={1}>
      <ApiProvider client={api.client} queryClient={api.queryClient}>
        <ToastProvider>
          <NavigationProvider>
            <SheetsProvider>
              {children ?? <TicketScreen projectKey={detail.project.key} num={detail.ticket.num} />}
              <Probes />
              <AppDrafts />
            </SheetsProvider>
          </NavigationProvider>
        </ToastProvider>
      </ApiProvider>
    </MemoryRouter>,
  );
  return { ...api, ...view, restorePhone };
}
