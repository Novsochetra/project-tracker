import { screen, within } from '@testing-library/react';
import type { HelperPlanUsage } from '@tracker/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithApi } from '../claude/test/renderWithApi';
import { ClaudeUsageSection } from './ClaudeUsageSection';
import { UNKNOWN } from './planUsageText';

const NOW = new Date(2026, 9, 14, 12, 0).getTime();

const MAC: HelperPlanUsage = {
  runnerId: 'r-1',
  runnerName: 'Dara’s MacBook',
  seenAt: NOW - 5 * 60_000,
  limits: {
    status: 'rejected',
    rateLimitType: 'five_hour',
    resetsAt: new Date(2026, 9, 14, 15, 40).getTime(),
    windows: {
      five_hour: { usedPercent: 100, resetsAt: new Date(2026, 9, 14, 15, 40).getTime() },
      seven_day: { usedPercent: 18, resetsAt: new Date(2026, 9, 19, 9, 0).getTime() },
    },
  },
};
const SERVER: HelperPlanUsage = {
  runnerId: 'r-2',
  runnerName: 'Server',
  seenAt: null,
  limits: null,
};

const renderSection = (usage: HelperPlanUsage[]) =>
  renderWithApi(<ClaudeUsageSection />, { listPlanUsage: vi.fn().mockResolvedValue(usage) });

afterEach(() => {
  vi.useRealTimers();
});

describe('ClaudeUsageSection', () => {
  it("shows each computer's windows, its limit and when it was said", async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: NOW });
    renderSection([MAC, SERVER]);
    const mac = await screen.findByRole('listitem', { name: 'Dara’s MacBook' });
    expect(within(mac).getByText('Limited until 3:40 PM')).toBeInTheDocument();
    expect(within(mac).getByText('100% used · resets 3:40 PM')).toBeInTheDocument();
    expect(within(mac).getByText('18% used · resets Mon 9:00 AM')).toBeInTheDocument();
    expect(within(mac).getByRole('meter', { name: 'Weekly used' })).toHaveAttribute(
      'aria-valuenow',
      '18',
    );
    expect(within(mac).getByText('As of a run that ended 5m ago')).toBeInTheDocument();
    const server = screen.getByRole('listitem', { name: 'Server' });
    expect(within(server).getByText(UNKNOWN)).toBeInTheDocument();
    expect(within(server).queryByRole('meter')).toBeNull();
  });

  it('shows nothing without a computer', async () => {
    const view = renderSection([]);
    await vi.waitFor(() => expect(view.client.listPlanUsage).toHaveBeenCalled());
    expect(screen.queryByRole('heading', { name: 'Claude usage' })).toBeNull();
  });
});
