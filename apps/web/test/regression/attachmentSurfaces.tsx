import { render, screen, within } from '@testing-library/react';
import type { TrackerClient } from '@tracker/client';
import { vi } from 'vitest';
import { queryKeys } from '../../src/api';
import { makeBoard } from '../../src/api/test/fixtures';
import { setupApi } from '../../src/api/test/render';
import { projectSummary, renderWithApp } from '../../src/app/test/harness';
import { ToastProvider } from '../../src/components';
import { CaptureSheet } from '../../src/features/capture/CaptureSheet';
import { NewTicketSheet } from '../../src/features/project/NewTicketSheet';
import { renderTicket } from '../../src/features/ticket/test/renderTicket';
import { mockPhone } from '../../src/overlays/testing';

type ClientOverrides = Parameters<typeof setupApi>[0];

export interface ShownSurface {
  client: TrackerClient;
  input: () => HTMLElement;
  // Where the person is looking when they pick: the sheet, the ticket's files or the comment box.
  area: () => HTMLElement;
  restore: () => void;
}

export interface Surface {
  name: string;
  show: (client?: ClientOverrides) => ShownSurface;
}

const sheet = () => screen.getByRole('dialog', { name: 'New ticket' });

const sheetSurface = (client: TrackerClient, restore: () => void): ShownSurface => ({
  client,
  input: () => within(sheet()).getByLabelText('Add files to ticket'),
  area: sheet,
  restore,
});

export const NEW_TICKET: Surface = {
  name: 'New ticket',
  show: (overrides = {}) => {
    const restorePhone = mockPhone(true);
    const api = setupApi({
      getBoard: vi.fn().mockResolvedValue(makeBoard()),
      listPeople: vi.fn().mockResolvedValue([]),
      deleteAttachment: vi.fn().mockResolvedValue(undefined),
      ...overrides,
    });
    api.queryClient.setQueryData(queryKeys.board('MOB'), makeBoard());
    const Wrapper = api.wrapper;
    render(
      <Wrapper>
        <ToastProvider>
          <NewTicketSheet open projectKey="MOB" onClose={() => undefined} />
        </ToastProvider>
      </Wrapper>,
    );
    return sheetSurface(api.client, restorePhone);
  },
};

export const CAPTURE: Surface = {
  name: 'quick capture',
  show: (overrides = {}) => {
    const restorePhone = mockPhone(true);
    const projects = [projectSummary()];
    const app = renderWithApp(<CaptureSheet open onClose={() => undefined} />, {
      projects,
      client: {
        listProjects: vi.fn().mockResolvedValue(projects),
        deleteAttachment: vi.fn().mockResolvedValue(undefined),
        ...overrides,
      },
    });
    return sheetSurface(app.client, restorePhone);
  },
};

export const TICKET_SCREEN: Surface = {
  name: 'the ticket screen',
  show: (overrides = {}) => {
    const shown = renderTicket({ phone: true, client: overrides });
    const input = () => screen.getByLabelText('Add files to ticket');
    return {
      client: shown.client,
      input,
      area: () => input().parentElement ?? document.body,
      restore: shown.restorePhone,
    };
  },
};

export const COMMENT_BOX: Surface = {
  name: 'the comment box',
  show: (overrides = {}) => {
    const shown = renderTicket({
      phone: true,
      client: { deleteAttachment: vi.fn().mockResolvedValue(undefined), ...overrides },
    });
    const input = () => screen.getByLabelText('Attach files to comment');
    return {
      client: shown.client,
      input,
      area: () => input().closest('form') ?? document.body,
      restore: shown.restorePhone,
    };
  },
};

export const SURFACES = [NEW_TICKET, CAPTURE, TICKET_SCREEN, COMMENT_BOX];
