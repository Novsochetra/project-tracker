import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { RunRequest } from '@tracker/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { announce } from '../../app/announce';
import { LiveRegion } from '../../app/LiveRegion';
import { setupApi } from '../../api/test/render';
import { makeRequest } from '../../api/test/requestFixtures';
import { ToastProvider } from '../../components';
import { RequestCards } from './RequestCards';
import { useRequests } from './useRequests';

afterEach(() => act(() => announce('')));

const PLAN = '# Rename the queue\n\n1. Rename **syncQueue**\n2. Run the tests';
const plan = (more: Partial<RunRequest> = {}) =>
  makeRequest({ kind: 'plan', label: PLAN, ...more } as Partial<RunRequest>);
const answered = (request: RunRequest, more: Partial<RunRequest>): RunRequest =>
  ({ ...request, status: 'answered', endedAt: Date.now(), ...more }) as RunRequest;

function Cards() {
  const requests = useRequests('r-1');
  return <RequestCards requests={requests.shown} now={requests.now} />;
}

function setup(requests: RunRequest[], answerRunRequest = vi.fn()) {
  const api = setupApi({ listRunRequests: vi.fn().mockResolvedValue(requests), answerRunRequest });
  const Wrapper = api.wrapper;
  render(
    <Wrapper>
      <ToastProvider>
        <LiveRegion />
        <Cards />
      </ToastProvider>
    </Wrapper>,
  );
  return userEvent.setup();
}

const card = () => screen.findByRole('region', { name: 'Claude asks: Rename the queue' });

describe('a plan request', () => {
  it('shows the plan as Markdown and the three choices', async () => {
    setup([plan()]);
    const shown = await card();
    expect(within(shown).getByText('Claude has a plan')).toBeVisible();
    expect(within(shown).getByRole('heading', { name: 'Rename the queue' })).toBeVisible();
    expect(within(shown).getByText('syncQueue').tagName).toBe('STRONG');
    for (const name of ['Approve and edit', 'Approve and auto', 'Keep planning']) {
      expect(within(shown).getByRole('button', { name })).toBeEnabled();
    }
    expect(within(shown).queryByText(/goes on past what is shown/)).toBeNull();
    expect(screen.getByText('Claude has a plan: Rename the queue')).toBeInTheDocument();
  });

  it.each([
    ['Approve and edit', 'edit', 'Approved: carried out in Edit'],
    ['Approve and auto', 'auto', 'Approved: carried out in Auto'],
  ])('%s sends the picked mode', async (name, mode, outcome) => {
    const request = plan();
    const answerRunRequest = vi
      .fn()
      .mockResolvedValue(answered(request, { decision: 'allow', answers: [mode] }));
    const user = setup([request], answerRunRequest);
    const shown = await card();
    await user.click(within(shown).getByRole('button', { name }));
    expect(answerRunRequest).toHaveBeenCalledWith('q-1', { decision: 'allow', answers: [mode] });
    expect(await within(shown).findByText(outcome)).toBeInTheDocument();
    expect(within(shown).queryByRole('button')).toBeNull();
  });

  it('keeps planning with the note the person typed', async () => {
    const request = plan();
    const kept = answered(request, { decision: 'deny', answers: ['Add tests first'] });
    const answerRunRequest = vi.fn().mockResolvedValue(kept);
    const user = setup([request], answerRunRequest);
    const shown = await card();
    const note = within(shown).getByRole('textbox', { name: /Note for Claude/ });
    await user.type(note, '  Add tests first ');
    await user.click(within(shown).getByRole('button', { name: 'Keep planning' }));
    expect(answerRunRequest).toHaveBeenCalledWith('q-1', {
      decision: 'deny',
      answers: ['Add tests first'],
    });
    expect(await within(shown).findByText('Add tests first')).toBeInTheDocument();
    expect(within(shown).getByText('Keep planning')).toBeInTheDocument();
  });

  it('keeps planning with no note at Enter in the empty box', async () => {
    const request = plan();
    const answerRunRequest = vi.fn().mockResolvedValue(answered(request, { decision: 'deny' }));
    const user = setup([request], answerRunRequest);
    const shown = await card();
    await user.type(within(shown).getByRole('textbox'), '{Enter}');
    expect(answerRunRequest).toHaveBeenCalledWith('q-1', { decision: 'deny' });
  });

  it('approves a plan cut at its limit in Edit only, and says why', async () => {
    setup([plan({ labelCut: true })]);
    const shown = await card();
    expect(
      within(shown).getByText(/goes on past what is shown, so it can be approved in Edit only/),
    ).toBeVisible();
    expect(within(shown).getByRole('button', { name: 'Approve and auto' })).toBeDisabled();
    expect(within(shown).getByRole('button', { name: 'Approve and edit' })).toBeEnabled();
  });
});
