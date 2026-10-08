import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { queryKeys } from '../../src/api';
import { listItem, makeBoard, STATUS } from '../../src/api/test/fixtures';
import { setupApi } from '../../src/api/test/render';
import { ToastProvider } from '../../src/components';
import { sheetTestSetup } from '../../src/features/claude/test/renderWithApi';
import { NewTicketSheet } from '../../src/features/project/NewTicketSheet';
import { phoneStyle, pixels } from './phoneCss';

// The New ticket title was a one-line input: on a phone a one-sentence idea scrolled sideways
// and showed only its end, so its start couldn't be reread without moving the caret (PT-29).

const IDEA = 'Let Claude group related tickets into one PR when they touch the same screen';

let restore: () => void = () => undefined;

beforeEach(() => {
  restore = sheetTestSetup(true);
});

afterEach(() => {
  restore();
  localStorage.clear();
});

function openNewTicket() {
  const {
    commentCount: _c,
    attachmentCount: _a,
    ...created
  } = listItem(5, STATUS.todo, -1, {
    title: IDEA,
  });
  const createTicket = vi.fn().mockResolvedValue(created);
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
        <NewTicketSheet open projectKey="MOB" onClose={() => undefined} />
      </ToastProvider>
    </Wrapper>,
  );
  return { createTicket, user: userEvent.setup() };
}

const titleField = () => screen.getByRole('textbox', { name: 'Ticket title' });

function phoneFontSize(element: Element, cssModule: string): number {
  const style = phoneStyle(element, cssModule);
  const font = style.get('font');
  return pixels(style.get('font-size') ?? (font ? /(\d+(?:\.\d+)?px)/.exec(font)?.[1] : ''));
}

describe('regression: a long New ticket title stays readable while typing on a phone', () => {
  it('wraps onto lines that grow and scroll, in text large enough that iOS does not zoom', async () => {
    const { user } = openNewTicket();
    await user.type(titleField(), IDEA);

    expect(titleField()).toBeInstanceOf(HTMLTextAreaElement);
    expect(titleField()).toHaveValue(IDEA);
    const css = 'components/TitleField/TitleField.module.css';
    expect(phoneFontSize(titleField(), css)).toBeGreaterThanOrEqual(16);
    expect(phoneStyle(titleField(), css).get('overflow-y')).toBe('auto');
  });

  it('keeps Return for Create: no line break, and a blank title still asks for one', async () => {
    const { user, createTicket } = openNewTicket();
    expect(titleField()).toHaveAttribute('enterkeyhint', 'done');
    await user.type(titleField(), '{Enter}');
    expect(screen.getByRole('alert')).toHaveTextContent('Add a title to create the ticket.');

    await user.type(titleField(), `${IDEA}{Enter}`);
    expect(titleField()).toHaveValue(IDEA);
    expect(createTicket).toHaveBeenCalledWith('MOB', expect.objectContaining({ title: IDEA }));
  });

  it('turns pasted line breaks into spaces', async () => {
    const { user } = openNewTicket();
    await user.click(titleField());
    await user.paste('Let Claude group related tickets\ninto one PR\n');
    expect(titleField()).toHaveValue('Let Claude group related tickets into one PR ');
  });
});
