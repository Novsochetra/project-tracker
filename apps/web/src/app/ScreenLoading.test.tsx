import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { makeBoard } from '../api/test/fixtures';
import { mockPhone } from '../overlays/testing';
import { ScreenLoading } from './ScreenLoading';
import { currentPath, renderWithApp } from './test/harness';

let restore: () => void = () => undefined;

afterEach(() => {
  restore();
});

const bar = () => document.querySelector('[data-navbar]');

describe('ScreenLoading', () => {
  it('on a phone, has a project’s bar with Back to Projects', async () => {
    restore = mockPhone(true);
    const user = userEvent.setup();
    renderWithApp(<ScreenLoading />, { path: '/p/MOB' });
    expect(screen.getByText('Loading')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Back to Projects' }));
    expect(currentPath()).toBe('/');
  });

  it('on a phone, has a ticket’s bar with its key and Back to its project', async () => {
    restore = mockPhone(true);
    const user = userEvent.setup();
    renderWithApp(<ScreenLoading />, {
      path: '/p/mob/3',
      client: { getProject: () => Promise.resolve(makeBoard()) },
    });
    expect(bar()).toHaveTextContent('MOB-3');
    await user.click(await screen.findByRole('button', { name: 'Back to Mobile app' }));
    expect(currentPath()).toBe('/p/mob');
  });

  it('on a desktop, leaves the way back to the sidebar and breadcrumb', () => {
    restore = mockPhone(false);
    renderWithApp(<ScreenLoading />, { path: '/p/MOB' });
    expect(bar()).toBeNull();
    expect(screen.getByText('Loading')).toBeInTheDocument();
  });

  it('shows its bar at once, unless quiet', () => {
    restore = mockPhone(true);
    const { unmount } = renderWithApp(<ScreenLoading />, { path: '/p/MOB' });
    expect(bar()?.closest('.quiet-in')).toBeNull();
    unmount();
    renderWithApp(<ScreenLoading quiet />, { path: '/p/MOB' });
    expect(bar()?.closest('.quiet-in')).not.toBeNull();
  });
});
