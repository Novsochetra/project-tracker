import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithApi } from '../claude/test/renderWithApi';
import { NotificationsSection } from './NotificationsSection';
import { stubIPhone, stubPush, unstubPush } from './test/fakePush';

const KEY = 'BP4z-_8';
const toggle = () => screen.getByRole('switch', { name: 'Notifications on this device' });

function renderSection(overrides: Parameters<typeof renderWithApi>[1] = {}) {
  const api = {
    getPushKey: vi.fn().mockResolvedValue({ publicKey: KEY }),
    savePushSubscription: vi.fn().mockResolvedValue(undefined),
    removePushSubscription: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  renderWithApi(<NotificationsSection />, api);
  return api;
}

afterEach(() => {
  unstubPush();
});

describe('NotificationsSection', () => {
  it('asks for permission within the tap, then saves this device on the tracker', async () => {
    const user = userEvent.setup();
    const push = stubPush();
    const api = renderSection();
    expect(await screen.findByText(/Tells you when Claude finishes/)).toBeInTheDocument();
    expect(toggle()).toHaveAttribute('aria-checked', 'false');
    await user.click(toggle());
    expect(push.notification.requestPermission).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(toggle()).toHaveAttribute('aria-checked', 'true'));
    const [options] = push.pushManager.subscribe.mock.calls[0]!;
    expect(options.userVisibleOnly).toBe(true);
    expect([...(options.applicationServerKey as Uint8Array)]).toEqual([4, 0xfe, 0x33, 0xfb, 0xff]);
    expect(api.savePushSubscription).toHaveBeenCalledWith(push.json);
  });

  it('asks before anything is awaited, as iOS shows the prompt only inside the tap', async () => {
    const push = stubPush();
    const api = renderSection();
    await screen.findByText(/Tells you when Claude finishes/);
    toggle().click();
    expect(push.notification.requestPermission).toHaveBeenCalledTimes(1);
    expect(api.getPushKey).not.toHaveBeenCalled();
    await waitFor(() => expect(toggle()).toHaveAttribute('aria-checked', 'true'));
  });

  it('turns off: the browser lets go of the device and the tracker forgets it', async () => {
    const user = userEvent.setup();
    const push = stubPush({ permission: 'granted', subscribed: true });
    const api = renderSection();
    await waitFor(() => expect(toggle()).toHaveAttribute('aria-checked', 'true'));
    await user.click(toggle());
    await waitFor(() => expect(toggle()).toHaveAttribute('aria-checked', 'false'));
    expect(push.subscription.unsubscribe).toHaveBeenCalled();
    expect(api.removePushSubscription).toHaveBeenCalledWith(push.json.endpoint);
  });

  it('says so when notifications are refused, and stays off', async () => {
    const user = userEvent.setup();
    const push = stubPush({ answer: 'denied' });
    renderSection();
    await screen.findByText(/Tells you when Claude finishes/);
    await user.click(toggle());
    expect(await screen.findByRole('alert')).toHaveTextContent('Notifications are blocked');
    expect(toggle()).toHaveAttribute('aria-checked', 'false');
    expect(toggle()).toBeDisabled();
    expect(push.pushManager.subscribe).not.toHaveBeenCalled();
  });

  it('lets the browser go of the device when the tracker could not save it', async () => {
    const user = userEvent.setup();
    const push = stubPush();
    renderSection({ savePushSubscription: vi.fn().mockRejectedValue(new TypeError('Failed')) });
    await screen.findByText(/Tells you when Claude finishes/);
    await user.click(toggle());
    expect(await screen.findByRole('alert')).toHaveTextContent("Can't reach the tracker.");
    expect(push.subscription.unsubscribe).toHaveBeenCalled();
    expect(toggle()).toHaveAttribute('aria-checked', 'false');
  });

  it('on an iPhone in Safari, says it works from the Home Screen', async () => {
    stubPush({ supported: false });
    const restore = stubIPhone(false);
    renderSection();
    expect(await screen.findByText(/once Tracker is on the Home Screen/)).toBeInTheDocument();
    expect(toggle()).toBeDisabled();
    restore();
  });

  it('says a browser without push can’t show notifications', async () => {
    stubPush({ supported: false });
    renderSection();
    expect(await screen.findByText("This browser can't show notifications.")).toBeInTheDocument();
    expect(toggle()).toBeDisabled();
  });
});
