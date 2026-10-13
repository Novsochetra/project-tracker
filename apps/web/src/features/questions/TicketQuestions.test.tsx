import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '@tracker/client';
import { RUN_REQUEST_DEADLINE_MS, type TicketQuestion } from '@tracker/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { announce } from '../../app/announce';
import { LiveRegion } from '../../app/LiveRegion';
import { setupApi } from '../../api/test/render';
import { ToastProvider } from '../../components';
import { TicketQuestions } from './TicketQuestions';

afterEach(() => act(() => announce('')));

const question = (more: Partial<TicketQuestion> = {}): TicketQuestion => ({
  id: 'q-1',
  ticketId: 't-1',
  runId: null,
  text: 'Which name should the setting have?',
  choices: ['Dark', 'Night'],
  status: 'open',
  answer: null,
  createdAt: Date.now(),
  expiresAt: Date.now() + RUN_REQUEST_DEADLINE_MS,
  endedAt: null,
  ...more,
});

const ended = (from: TicketQuestion, more: Partial<TicketQuestion>): TicketQuestion => ({
  ...from,
  endedAt: Date.now(),
  ...more,
});

function setup(questions: TicketQuestion[], answerQuestion = vi.fn()) {
  const listQuestions = vi.fn().mockResolvedValue(questions);
  const api = setupApi({ listQuestions, answerQuestion });
  const Wrapper = api.wrapper;
  render(
    <Wrapper>
      <ToastProvider>
        <LiveRegion />
        <TicketQuestions ticketKey="MOB-1" />
      </ToastProvider>
    </Wrapper>,
  );
  return { listQuestions, answerQuestion };
}

const card = () =>
  screen.findByRole('region', { name: 'Claude asks: Which name should the setting have?' });

describe('a question Claude asks on the ticket', () => {
  it('shows the question with its choices, and a tap on one answers it', async () => {
    const asked = question();
    const answerQuestion = vi
      .fn()
      .mockResolvedValue(ended(asked, { status: 'answered', answer: 'Night' }));
    const { listQuestions } = setup([asked], answerQuestion);
    const user = userEvent.setup();
    const shown = await card();

    expect(listQuestions).toHaveBeenCalledWith('MOB-1');
    expect(within(shown).getByText('Claude asks you')).toBeVisible();
    expect(screen.getByText('Claude asks you: Which name should the setting have?')).toBeVisible();
    await user.click(within(shown).getByRole('button', { name: 'Night' }));

    expect(answerQuestion).toHaveBeenCalledWith('q-1', { answer: 'Night' });
    expect(await within(shown).findByText('Night')).toBeInTheDocument();
    expect(within(shown).queryByRole('button')).toBeNull();
  });

  it("sends the person's own words, or a skip", async () => {
    const asked = question({ choices: [] });
    const answerQuestion = vi
      .fn()
      .mockResolvedValue(ended(asked, { status: 'answered', answer: 'Call it Dusk' }));
    setup([asked], answerQuestion);
    const user = userEvent.setup();
    const shown = await card();
    expect(within(shown).getByRole('button', { name: 'Send answer' })).toBeDisabled();
    await user.type(within(shown).getByRole('textbox'), 'Call it Dusk');
    await user.click(within(shown).getByRole('button', { name: 'Send answer' }));
    expect(answerQuestion).toHaveBeenCalledWith('q-1', { answer: 'Call it Dusk' });
    expect(await within(shown).findByText('Call it Dusk')).toBeInTheDocument();
  });

  it('skips', async () => {
    const asked = question();
    const answerQuestion = vi.fn().mockResolvedValue(ended(asked, { status: 'skipped' }));
    setup([asked], answerQuestion);
    const user = userEvent.setup();
    await user.click(within(await card()).getByRole('button', { name: 'Skip' }));
    expect(answerQuestion).toHaveBeenCalledWith('q-1', { skip: true });
    expect(await screen.findByText('Skipped')).toBeInTheDocument();
  });

  it('shows how it ended when another device answered first', async () => {
    const asked = question();
    const answerQuestion = vi
      .fn()
      .mockRejectedValue(new ApiError(409, 'conflict', 'This was already answered.'));
    const { listQuestions } = setup([asked], answerQuestion);
    listQuestions.mockResolvedValueOnce([asked]);
    listQuestions.mockResolvedValue([ended(asked, { status: 'answered', answer: 'Dark' })]);
    const user = userEvent.setup();
    await user.click(within(await card()).getByRole('button', { name: 'Night' }));
    expect(await screen.findByText('Dark')).toBeInTheDocument();
    expect(screen.queryByText('This was already answered.')).toBeNull();
  });

  it('shows nothing when Claude asked nothing, or only long ago', async () => {
    const old = ended(question(), { status: 'answered', answer: 'Dark', endedAt: 1 });
    const { listQuestions } = setup([old]);
    await vi.waitFor(() => expect(listQuestions).toHaveBeenCalled());
    expect(screen.queryByRole('region', { name: "Claude's questions" })).toBeNull();
  });
});
