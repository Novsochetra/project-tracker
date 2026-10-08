import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReportPreview } from '@tracker/shared';
import { useState } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { project, statuses } from '../../src/api/test/fixtures';
import type { ReportScope } from '../../src/app/sheets/types';
import { ReportSheet } from '../../src/features/claude/ReportSheet';
import { renderWithApi } from '../../src/features/claude/test/renderWithApi';
import { mockPhone } from '../../src/overlays/testing';

const REPORT = 'TICKET: MOB-1\nSTATUS: done';
const scope: ReportScope = { kind: 'project', projectKey: 'MOB' };

const previewFor = (applied: boolean): ReportPreview => ({
  items: [
    {
      key: 'MOB-1',
      matched: true,
      ticketKey: 'MOB-1',
      ticketTitle: 'Login error',
      fromStatusName: applied ? 'Need review' : 'In progress',
      toStatusName: applied ? null : 'Need review',
    },
  ],
  matchedCount: 1,
});

function Harness() {
  const [open, setOpen] = useState(true);
  return <ReportSheet open={open} onClose={() => setOpen(false)} scope={scope} />;
}

function describeSheet(): string | null {
  const overlay = document.querySelector('[data-sheet]');
  if (!overlay) return null;
  const apply = [...overlay.querySelectorAll('button')].find((b) => b.textContent === 'Apply');
  const rows = [...overlay.querySelectorAll('li')].map((row) => row.textContent).join(' / ');
  const phase = overlay.hasAttribute('inert') ? 'closing' : 'open';
  return `${phase}: ${rows} · Apply ${apply?.disabled ? 'disabled' : 'enabled'}`;
}

function recordSheet(): () => string[] {
  const seen = new Set<string>();
  const observer = new MutationObserver(() => {
    const state = describeSheet();
    if (state) seen.add(state);
  });
  observer.observe(document.body, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['disabled', 'inert'],
  });
  return () => {
    observer.disconnect();
    return [...seen];
  };
}

let restore: () => void;

beforeEach(() => {
  restore = mockPhone(false);
});

afterEach(() => {
  restore();
});

// Applying moves the ticket, so the preview refetched while the sheet animated out: the closing
// sheet flipped its row to "Add report" and turned Apply back on.
it('keeps the closing report sheet as it was when Apply was pressed', async () => {
  let applied = false;
  const api = {
    getProject: vi.fn().mockResolvedValue({ project, statuses }),
    previewReport: vi.fn(() => Promise.resolve(previewFor(applied))),
    applyReport: vi.fn(() => {
      applied = true;
      return Promise.resolve({ updatedTicketKeys: ['MOB-1'] });
    }),
  };
  renderWithApi(<Harness />, api);
  const user = userEvent.setup();
  await user.click(screen.getByRole('textbox', { name: 'Report' }));
  await user.paste(REPORT);
  await screen.findByText('In progress → Need review');

  const stop = recordSheet();
  await user.click(screen.getByRole('button', { name: 'Apply' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  const closing = stop().filter((state) => state.startsWith('closing'));

  expect(api.previewReport).toHaveBeenCalledTimes(2);
  expect(closing).toEqual([expect.stringContaining('MOB-1Login errorIn progress → Need review')]);
});
