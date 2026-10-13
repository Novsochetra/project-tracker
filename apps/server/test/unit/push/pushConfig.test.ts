import { describe, expect, it } from 'vitest';
import { loadPushSettings } from '../../../src/push/pushConfig';
import { generateVapidKeys } from '../../../src/push/vapidKeys';

const KEYS = generateVapidKeys();
const ENV = { VAPID_PUBLIC_KEY: KEYS.publicKey, VAPID_PRIVATE_KEY: KEYS.privateKey };

describe('loadPushSettings', () => {
  it('takes the keys and subject from the environment', () => {
    expect(loadPushSettings({ ...ENV, VAPID_SUBJECT: 'mailto:me@example.com' }, null)).toEqual({
      keys: KEYS,
      subject: 'mailto:me@example.com',
    });
  });

  it('leaves the keys to the server without them, and names the https address', () => {
    expect(loadPushSettings({}, 'https://tracker.up.railway.app')).toEqual({
      keys: null,
      subject: 'https://tracker.up.railway.app',
    });
    expect(loadPushSettings({}, 'http://192.168.1.4:4100').subject).toBe(
      'mailto:tracker@localhost',
    );
  });

  it('stops the start for one key alone or a key set wrong', () => {
    expect(() => loadPushSettings({ VAPID_PUBLIC_KEY: KEYS.publicKey }, null)).toThrow(
      'Set both VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY',
    );
    expect(() => loadPushSettings({ ...ENV, VAPID_PRIVATE_KEY: 'short' }, null)).toThrow('P-256');
  });

  it('stops the start for a subject push services would refuse', () => {
    for (const subject of ['me@example.com', 'mailto:', 'http://tracker.example.com', 'tracker']) {
      expect(() => loadPushSettings({ VAPID_SUBJECT: subject }, null), subject).toThrow(
        'VAPID_SUBJECT must be',
      );
    }
    expect(loadPushSettings({ VAPID_SUBJECT: 'https://tracker.example.com' }, null).subject).toBe(
      'https://tracker.example.com',
    );
  });
});
