import { describe, expect, it } from 'vitest';
import { pushSubscriptionInput } from '../src/api/push';
import { isPushServiceUrl } from '../src/logic/pushServices';

describe('isPushServiceUrl', () => {
  it("takes the browsers' push services over https", () => {
    expect(isPushServiceUrl('https://web.push.apple.com/QK1')).toBe(true);
    expect(isPushServiceUrl('https://fcm.googleapis.com/fcm/send/x')).toBe(true);
    expect(isPushServiceUrl('https://updates.push.services.mozilla.com/wpush/v2/x')).toBe(true);
    expect(isPushServiceUrl('https://wns2-db5p.notify.windows.com/w/?token=x')).toBe(true);
  });

  it('refuses any other address, plain http and look-alike hosts', () => {
    expect(isPushServiceUrl('http://web.push.apple.com/QK1')).toBe(false);
    expect(isPushServiceUrl('https://postgres.railway.internal/x')).toBe(false);
    expect(isPushServiceUrl('https://127.0.0.1/x')).toBe(false);
    expect(isPushServiceUrl('https://evilgoogleapis.com/x')).toBe(false);
    expect(isPushServiceUrl('not a url')).toBe(false);
  });

  it('is what a subscription is checked with', () => {
    const keys = { p256dh: 'p', auth: 'a' };
    expect(pushSubscriptionInput.safeParse({ endpoint: 'https://x.test/', keys }).success).toBe(
      false,
    );
    expect(
      pushSubscriptionInput.safeParse({ endpoint: 'https://web.push.apple.com/a', keys }).success,
    ).toBe(true);
  });
});
