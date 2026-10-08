import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { queryKeys } from '../../src/api';
import { makeBoard } from '../../src/api/test/fixtures';
import { setupApi } from '../../src/api/test/render';
import { ToastProvider } from '../../src/components';
import { sheetTestSetup } from '../../src/features/claude/test/renderWithApi';
import { NewTicketSheet } from '../../src/features/project/NewTicketSheet';
import { installExecCommand, webkitInsertText } from './webkitEditing';

// In WebKit, text with line breaks from a keyboard's insert (dictation, clipboard keyboards, text
// replacements) lost everything after the first break in the New ticket title: WebKit inserts it
// line by line, and the title rewrote its value during the first break, which ends the insert
// (PT-29 review).

let restore: Array<() => void> = [];

beforeEach(() => {
  restore = [sheetTestSetup(true), installExecCommand()];
});

afterEach(() => {
  restore.forEach((undo) => undo());
  localStorage.clear();
});

function openNewTicket() {
  const api = setupApi({
    getBoard: vi.fn().mockResolvedValue(makeBoard()),
    listPeople: vi.fn().mockResolvedValue([]),
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
  return userEvent.setup();
}

const titleField = () => screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Ticket title' });

describe('regression: a keyboard insert with line breaks keeps all of its text in the title', () => {
  it('keeps every line after typing, joined by spaces', async () => {
    const user = openNewTicket();
    await user.type(titleField(), 'Fix the login');
    webkitInsertText(titleField(), ' on iPad\ncrash after rotate\nsteps inside');
    expect(titleField()).toHaveValue('Fix the login on iPad crash after rotate steps inside');
    expect(titleField().selectionStart).toBe(titleField().value.length);
  });

  it('joins the lines of a paste before the length limit cuts it', async () => {
    const user = openNewTicket();
    await user.click(titleField());
    webkitInsertText(titleField(), 'a'.repeat(290));
    await user.paste(`bc${'\n'.repeat(8)}defgh`);
    expect(titleField()).toHaveValue(`${'a'.repeat(290)}bc defgh`);
  });

  it('adds no space before text that starts with a break', async () => {
    const user = openNewTicket();
    await user.click(titleField());
    webkitInsertText(titleField(), '\nLeading break');
    expect(titleField()).toHaveValue('Leading break');
  });
});
