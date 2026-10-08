import { screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeTicketDetail, project, statuses } from '../../src/api/test/fixtures';
import { PromptSheet } from '../../src/features/claude/PromptSheet';
import { ReportSheet } from '../../src/features/claude/ReportSheet';
import { renderWithApi, sheetTestSetup } from '../../src/features/claude/test/renderWithApi';
import { phoneStyle } from './phoneCss';

function phoneFontSize(element: Element, cssModule: string): string | undefined {
  const style = phoneStyle(element, cssModule);
  const font = style.get('font');
  return style.get('font-size') ?? (font ? /(\d+(?:\.\d+)?px)/.exec(font)?.[1] : undefined);
}

let restore: () => void;

beforeEach(() => {
  restore = sheetTestSetup(true);
});

afterEach(() => {
  restore();
});

// iOS Safari zooms the page into a focused field whose text is under 16px, and the viewport
// allows zooming, so the prompt box (mono 12px in the design) zoomed in when tapped (SPEC §11).
describe('regression: the Claude Code sheet boxes use 16px text on phones', () => {
  it('in the Send to Claude Code prompt box', async () => {
    renderWithApi(
      <PromptSheet open onClose={() => undefined} scope={{ kind: 'ticket', ticketKey: 'MOB-1' }} />,
      {
        getTicketPrompt: vi
          .fn()
          .mockResolvedValue({ text: 'Please work on MOB-1', ticketCount: 1 }),
        getTicket: vi.fn().mockResolvedValue(makeTicketDetail()),
      },
    );
    const box = await screen.findByRole('textbox', { name: 'Prompt for Claude Code' });
    expect(phoneFontSize(box, 'features/claude/PromptSheet.module.css')).toBe('16px');
  });

  it('in the Paste report box', () => {
    renderWithApi(
      <ReportSheet open onClose={() => undefined} scope={{ kind: 'project', projectKey: 'MOB' }} />,
      { getProject: vi.fn().mockResolvedValue({ project, statuses }) },
    );
    const box = screen.getByRole('textbox', { name: 'Report' });
    expect(phoneFontSize(box, 'features/claude/ReportSheet.module.css')).toBe('16px');
  });
});
