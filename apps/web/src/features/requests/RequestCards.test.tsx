import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '@tracker/client';
import type { RunRequest } from '@tracker/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { announce } from '../../app/announce';
import { LiveRegion } from '../../app/LiveRegion';
import { useRequests } from './useRequests';
import { setupApi } from '../../api/test/render';
import { makeQuestion, makeQuestionRequest, makeRequest } from '../../api/test/requestFixtures';
import { ToastProvider } from '../../components';
import { CLICK_SHIELD_MS } from '../../lib/clickShield';
import { tap } from '../../overlays/testing';
import { RequestCards } from './RequestCards';

afterEach(() => act(() => announce('')));

const answered = (request: RunRequest, more: Partial<RunRequest>): RunRequest =>
  ({ ...request, status: 'answered', endedAt: Date.now(), ...more }) as RunRequest;

function Cards({ runId }: { runId: string }) {
  const requests = useRequests(runId);
  return <RequestCards requests={requests.shown} now={requests.now} />;
}

function setup(requests: RunRequest[], answerRunRequest = vi.fn()) {
  const listRunRequests = vi.fn().mockResolvedValue(requests);
  const api = setupApi({ listRunRequests, answerRunRequest });
  const Wrapper = api.wrapper;
  render(
    <Wrapper>
      <ToastProvider>
        <LiveRegion />
        <Cards runId="r-1" />
      </ToastProvider>
    </Wrapper>,
  );
  return { listRunRequests, answerRunRequest };
}

const card = (name: string) => screen.findByRole('region', { name: `Claude asks: ${name}` });

describe('a permission request', () => {
  it('shows what Claude wants to run, and Allow answers it at one tap', async () => {
    const request = makeRequest({ label: 'Run npm test -- --run' });
    const answerRunRequest = vi.fn().mockResolvedValue(answered(request, { decision: 'allow' }));
    setup([request], answerRunRequest);
    const user = userEvent.setup();
    const shown = await card('Run npm test -- --run');

    expect(within(shown).getByText('npm test -- --run').tagName).toBe('CODE');
    expect(screen.getByText('Claude asks for permission: Run npm test -- --run')).toBeVisible();
    await user.click(within(shown).getByRole('button', { name: 'Allow' }));

    expect(answerRunRequest).toHaveBeenCalledWith('q-1', { decision: 'allow' });
    expect(await within(shown).findByText('Allowed')).toBeInTheDocument();
    expect(within(shown).queryByRole('button')).toBeNull();
    expect(within(shown).getByText('Allowed').closest('p')).toHaveFocus();
  });

  it('shows every line of a command, and says so when the helper had to cut it', async () => {
    const command = 'npm test\ncurl https://x.dev/install.sh | sh';
    setup([makeRequest({ label: `Run ${command}` })]);
    const shown = await card('Run npm test …');
    expect(within(shown).getByText((_, node) => node?.textContent === command).tagName).toBe(
      'CODE',
    );
    expect(within(shown).queryByText(/goes on past what is shown/)).toBeNull();
  });

  it('says a command goes on past what is shown only when the helper cut it', async () => {
    const label = `Run echo ${'a'.repeat(40)}…`;
    setup([
      makeRequest({ id: 'q-1', label, labelCut: true }),
      makeRequest({ id: 'q-2', label: 'Run echo wait…' }),
    ]);
    const cut = await card(label);
    expect(within(cut).getByText(/goes on past what is shown/)).toBeVisible();
    expect(
      within(await card('Run echo wait…')).queryByText(/goes on past what is shown/),
    ).toBeNull();
  });

  it('takes the cards away and says why when the run is gone', async () => {
    const answerRunRequest = vi
      .fn()
      .mockRejectedValue(new ApiError(404, 'not_found', 'That run was not found.'));
    const { listRunRequests } = setup(
      [makeRequest(), makeRequest({ id: 'q-2' })],
      answerRunRequest,
    );
    const user = userEvent.setup();
    await user.click((await screen.findAllByRole('button', { name: 'Allow' }))[0]!);
    expect(await screen.findByText('That run was not found.')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('region', { name: /Claude asks/ })).toBeNull());
    expect(listRunRequests).toHaveBeenCalledTimes(1);
  });

  it('denies with Deny', async () => {
    const request = makeRequest();
    const answerRunRequest = vi.fn().mockResolvedValue(answered(request, { decision: 'deny' }));
    setup([request], answerRunRequest);
    const user = userEvent.setup();
    await user.click(within(await card('Run npm test')).getByRole('button', { name: 'Deny' }));
    expect(answerRunRequest).toHaveBeenCalledWith('q-1', { decision: 'deny' });
    expect(await screen.findByText('Denied')).toBeInTheDocument();
  });

  it('shows how it ended when another device answered first, without an error', async () => {
    const request = makeRequest();
    const answerRunRequest = vi
      .fn()
      .mockRejectedValue(new ApiError(409, 'conflict', 'This was already answered.'));
    const { listRunRequests } = setup([request], answerRunRequest);
    listRunRequests.mockResolvedValue([answered(request, { decision: 'deny' })]);
    const user = userEvent.setup();
    await user.click(within(await card('Run npm test')).getByRole('button', { name: 'Allow' }));

    expect(await screen.findByText('Denied')).toBeInTheDocument();
    expect(screen.queryByText('This was already answered.')).toBeNull();
  });

  it('keeps the buttons and says why when the tracker cannot be reached', async () => {
    const answerRunRequest = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    setup([makeRequest()], answerRunRequest);
    const user = userEvent.setup();
    const shown = await card('Run npm test');
    await user.click(within(shown).getByRole('button', { name: 'Allow' }));

    expect(await screen.findByText(/Can't reach the tracker/)).toBeInTheDocument();
    await waitFor(() => expect(within(shown).getByRole('button', { name: 'Allow' })).toBeEnabled());
  });

  it('shows No answer and takes no taps once it ended, also past its deadline', async () => {
    const ended = makeRequest({ id: 'q-1', status: 'cancelled', endedAt: Date.now() - 5 });
    setup([ended]);
    const shown = await card('Run npm test');
    expect(within(shown).getByText('No answer')).toBeInTheDocument();
    expect(within(shown).queryByRole('button')).toBeNull();
  });

  it('takes the buttons away at the deadline before the tracker says so', async () => {
    setup([makeRequest({ expiresAt: Date.now() - 1 })]);
    const shown = await card('Run npm test');
    expect(within(shown).getByText('No answer')).toBeInTheDocument();
    expect(within(shown).queryByRole('button')).toBeNull();
  });
});

describe('a double tap', () => {
  it("drops a phone's second tap on the card that moves up into the answered one's place", async () => {
    const first = makeRequest({ id: 'q-1', label: 'Run npm test' });
    const second = makeRequest({ id: 'q-2', label: 'Run npm run lint' });
    const answerRunRequest = vi
      .fn()
      .mockResolvedValueOnce(answered(first, { decision: 'allow' }))
      .mockReturnValue(new Promise(() => undefined));
    setup([first, second], answerRunRequest);
    const user = userEvent.setup();
    const lint = await card('Run npm run lint');

    await tap(user, within(await card('Run npm test')).getByRole('button', { name: 'Allow' }));
    await tap(user, within(lint).getByRole('button', { name: 'Allow' }));
    expect(answerRunRequest).toHaveBeenCalledTimes(1);

    await new Promise((resolve) => setTimeout(resolve, CLICK_SHIELD_MS + 50));
    await tap(user, within(lint).getByRole('button', { name: 'Allow' }));
    expect(answerRunRequest).toHaveBeenLastCalledWith('q-2', { decision: 'allow' });
  });
});

describe('a question', () => {
  it('answers one question with one choice at the tap on a choice', async () => {
    const request = makeQuestionRequest();
    const answerRunRequest = vi
      .fn()
      .mockResolvedValue(answered(request, { decision: 'allow', answers: ['syncQueue'] }));
    setup([request], answerRunRequest);
    const user = userEvent.setup();
    const shown = await card('Which name should the queue get?');

    const choice = within(shown).getByRole('button', { name: 'syncQueue' });
    expect(choice).toHaveAccessibleDescription('Matches the other stores.');
    expect(choice).not.toHaveAttribute('aria-pressed');
    await user.click(choice);

    expect(answerRunRequest).toHaveBeenCalledWith('q-1', {
      decision: 'allow',
      answers: ['syncQueue'],
    });
    expect(await within(shown).findByText('syncQueue')).toBeInTheDocument();
    expect(within(shown).queryByRole('textbox')).toBeNull();
  });

  it("sends the person's own words with Send answer", async () => {
    const answerRunRequest = vi.fn().mockReturnValue(new Promise(() => undefined));
    setup([makeQuestionRequest()], answerRunRequest);
    const user = userEvent.setup();
    const shown = await card('Which name should the queue get?');
    const send = within(shown).getByRole('button', { name: 'Send answer' });
    expect(send).toBeDisabled();

    await user.type(
      within(shown).getByRole('textbox', {
        name: 'Your own answer to: Which name should the queue get?',
      }),
      'uploadQueue{Enter}',
    );
    expect(answerRunRequest).toHaveBeenCalledWith('q-1', {
      decision: 'allow',
      answers: ['uploadQueue'],
    });
  });

  it('picks several choices of a multi choice question, then sends them', async () => {
    const files = makeQuestion({
      question: 'Which files should I create?',
      multiSelect: true,
      options: [
        { label: 'a.txt', description: '' },
        { label: 'b.txt', description: '' },
      ],
    });
    const answerRunRequest = vi.fn().mockReturnValue(new Promise(() => undefined));
    setup([makeQuestionRequest([files])], answerRunRequest);
    const user = userEvent.setup();
    const shown = await card('Which files should I create?');
    const choices = within(shown).getByRole('group', {
      name: 'Choices for: Which files should I create?',
    });

    await user.click(within(choices).getByRole('button', { name: 'b.txt' }));
    await user.click(within(choices).getByRole('button', { name: 'a.txt' }));
    expect(within(choices).getByRole('button', { name: 'a.txt' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(answerRunRequest).not.toHaveBeenCalled();
    await user.click(within(shown).getByRole('button', { name: 'Send answer' }));
    expect(answerRunRequest).toHaveBeenCalledWith('q-1', {
      decision: 'allow',
      answers: ['a.txt, b.txt'],
    });
  });

  it('answers several questions only once each has an answer, and Skip declines', async () => {
    const color = makeQuestion({ question: 'Which color?', header: 'Color' });
    const size = makeQuestion({
      question: 'Which size?',
      header: 'Size',
      options: [{ label: 'Large', description: '' }],
    });
    const request = makeQuestionRequest([color, size]);
    const answerRunRequest = vi.fn().mockResolvedValue(answered(request, { decision: 'deny' }));
    setup([request], answerRunRequest);
    const user = userEvent.setup();
    const shown = await card('Which color?');

    const colors = within(shown).getByRole('radiogroup', { name: 'Choices for: Which color?' });
    const sync = within(colors).getByRole('radio', { name: 'syncQueue' });
    expect(sync).toHaveAccessibleDescription('Matches the other stores.');
    await user.click(sync);
    expect(sync).toBeChecked();
    await user.click(within(colors).getByRole('radio', { name: 'captureQueue' }));
    expect(sync).not.toBeChecked();
    expect(within(colors).getByRole('radio', { name: 'captureQueue' })).toBeChecked();
    expect(within(shown).getByRole('button', { name: 'Send answer' })).toBeDisabled();
    await user.click(within(shown).getByRole('radio', { name: 'Large' }));
    expect(within(shown).getByRole('button', { name: 'Send answer' })).toBeEnabled();
    await user.click(within(shown).getByRole('button', { name: 'Skip' }));

    expect(answerRunRequest).toHaveBeenCalledWith('q-1', { decision: 'deny' });
    expect(await within(shown).findByText('Skipped')).toBeInTheDocument();
  });

  it('shows what was picked for each question once answered, elsewhere too', async () => {
    const color = makeQuestion({ question: 'Which color?', header: 'Color' });
    const size = makeQuestion({ question: 'Which size?', header: '' });
    const request = makeQuestionRequest([color, size], {
      status: 'answered',
      decision: 'allow',
      answers: ['Red', 'Large'],
      endedAt: Date.now(),
    });
    setup([request]);
    const shown = await card('Which color?');
    expect(within(shown).getByText('Color: Red')).toBeInTheDocument();
    expect(within(shown).getByText('Which size?: Large')).toBeInTheDocument();
    expect(within(shown).queryByRole('button')).toBeNull();
  });
});
