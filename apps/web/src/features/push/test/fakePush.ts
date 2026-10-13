import { vi } from 'vitest';

export interface FakePushOptions {
  permission?: NotificationPermission;
  answer?: NotificationPermission;
  subscribed?: boolean;
  supported?: boolean;
}

const SUBSCRIPTION_JSON = {
  endpoint: 'https://web.push.apple.com/device-1',
  keys: { p256dh: 'BPhone', auth: 'secret' },
};

export function stubPush({
  permission = 'default',
  answer = 'granted',
  subscribed = false,
  supported = true,
}: FakePushOptions = {}) {
  const unsubscribe = vi.fn(() => Promise.resolve(true));
  const subscription = {
    endpoint: SUBSCRIPTION_JSON.endpoint,
    toJSON: () => SUBSCRIPTION_JSON,
    unsubscribe: vi.fn(() => {
      current = null;
      return unsubscribe();
    }),
  };
  let current: typeof subscription | null = subscribed ? subscription : null;
  const notification = {
    permission,
    requestPermission: vi.fn(() => {
      notification.permission = answer;
      return Promise.resolve(answer);
    }),
  };
  const pushManager = {
    getSubscription: vi.fn(() => Promise.resolve(current)),
    subscribe: vi.fn((_options: PushSubscriptionOptionsInit) => {
      current = subscription;
      return Promise.resolve(subscription);
    }),
  };
  const worker = Object.assign(new EventTarget(), {
    getRegistration: vi.fn(() => Promise.resolve({ pushManager })),
  });
  vi.stubGlobal('Notification', notification);
  if (supported) vi.stubGlobal('PushManager', function PushManager() {});
  Object.defineProperty(navigator, 'serviceWorker', { value: worker, configurable: true });
  return { notification, pushManager, subscription, worker, json: SUBSCRIPTION_JSON };
}

export function unstubPush(): void {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, 'serviceWorker');
}

export function stubIPhone(standalone: boolean): () => void {
  const agent = vi
    .spyOn(navigator, 'userAgent', 'get')
    .mockReturnValue('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)');
  Object.defineProperty(navigator, 'standalone', { value: standalone, configurable: true });
  return () => {
    agent.mockRestore();
    Reflect.deleteProperty(navigator, 'standalone');
  };
}
