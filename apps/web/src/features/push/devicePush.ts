import type { TrackerClient } from '@tracker/client';
import { isIOS, isStandalone } from '../../lib/platform';
import { pushManager } from '../../pwa/pushManager';
import { keyBytes } from './keyBytes';
import { pushSupportOf, type PushSupport } from './pushSupport';

export interface DevicePush {
  support: PushSupport;
  on: boolean;
}

const notifications = (): typeof Notification | null =>
  typeof Notification === 'undefined' ? null : Notification;

export async function readDevicePush(): Promise<DevicePush> {
  const manager = await pushManager();
  const permission = notifications()?.permission ?? null;
  const support = pushSupportOf({
    canPush: manager !== null,
    permission,
    ios: isIOS(),
    standalone: isStandalone(),
  });
  const subscribed = (await manager?.getSubscription()) ?? null;
  return { support, on: support === 'ready' && permission === 'granted' && subscribed !== null };
}

export class PushRefused extends Error {}

const inputOf = (subscription: PushSubscription) => {
  const { endpoint, keys } = subscription.toJSON();
  return { endpoint: endpoint ?? '', keys: { p256dh: keys?.p256dh ?? '', auth: keys?.auth ?? '' } };
};

// The permission is asked first, before anything is awaited: iOS asks only inside the tap.
export async function turnPushOn(client: TrackerClient): Promise<void> {
  const permission = await (notifications()?.requestPermission() ?? Promise.resolve('denied'));
  if (permission !== 'granted') throw new PushRefused();
  const manager = await pushManager();
  if (!manager) throw new PushRefused();
  const { publicKey } = await client.getPushKey();
  // One made with another key (the tracker's keys changed) can't be subscribed over.
  await (await manager.getSubscription())?.unsubscribe();
  const subscription = await manager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: keyBytes(publicKey),
  });
  try {
    await client.savePushSubscription(inputOf(subscription));
  } catch (error) {
    // Else the switch would read on while the tracker has nowhere to send.
    await subscription.unsubscribe();
    throw error;
  }
}

// The push service drops an address the browser let go of, so the tracker's copy is told only as a
// courtesy: its failure changes nothing.
export async function turnPushOff(client: TrackerClient): Promise<void> {
  const subscription = await (await pushManager())?.getSubscription();
  if (!subscription) return;
  await subscription.unsubscribe();
  await client.removePushSubscription(subscription.endpoint).catch(() => undefined);
}
