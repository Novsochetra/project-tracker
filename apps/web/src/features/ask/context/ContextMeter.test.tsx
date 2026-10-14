import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ChatContext } from '@tracker/shared';
import { describe, expect, it } from 'vitest';
import { CONTEXT_FULL_HINT } from './contextCopy';
import { ContextMeter } from './ContextMeter';

const WINDOW = 200_000;
const at = (percent: number): ChatContext => ({
  used: (WINDOW * percent) / 100,
  window: WINDOW,
  tokens: 1_240_000,
});

const meter = () => screen.getByRole('button', { name: /^Context/ });
const levelOf = () => meter().closest('.context');

describe('ContextMeter', () => {
  it('says how full the context is, quietly, below 80%', () => {
    render(<ContextMeter context={at(70)} />);
    expect(meter()).toHaveTextContent('Context 70%');
    expect(levelOf()).toHaveClass('ok');
    expect(screen.queryByText(CONTEXT_FULL_HINT)).toBeNull();
  });

  it.each([
    [80, 'full'],
    [94, 'full'],
    [95, 'critical'],
    [100, 'critical'],
  ])('turns %s%% %s and says to start a new chat', (percent, level) => {
    render(<ContextMeter context={at(percent)} />);
    expect(meter()).toHaveTextContent(`Context ${percent}%`);
    expect(levelOf()).toHaveClass(level);
    expect(screen.getByText(CONTEXT_FULL_HINT)).toBeVisible();
  });

  it('shows the token numbers on a tap, and hides them on the next', async () => {
    const user = userEvent.setup();
    render(<ContextMeter context={{ used: 140_000, window: WINDOW, tokens: 1_240_000 }} />);
    const used = "140,000 of 200,000 tokens in Claude's context";
    expect(screen.queryByText(used)).not.toBeVisible();
    await user.click(meter());
    expect(meter()).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(used)).toBeVisible();
    expect(screen.getByText('This chat used 1,240,000 tokens in all')).toBeVisible();
    await user.click(meter());
    expect(screen.queryByText(used)).not.toBeVisible();
  });
});
