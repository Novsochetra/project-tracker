import { expect, it } from 'vitest';
import { isPushServiceUrl } from '../../src/logic/pushServices';

// Any *.googleapis.com or *.mozilla.com on any port passed, so a subscription could point the
// server at Google's metadata or storage hosts, or at another port of a push host (PT-201 review).
it('takes only the push services themselves, on the https port', () => {
  for (const refused of [
    'https://storage.googleapis.com/bucket/x',
    'https://metadata.googleapis.com/computeMetadata/v1/',
    'https://googleapis.com/x',
    'https://www.mozilla.com/x',
    'https://push.services.mozilla.com.evil.example/x',
    'https://fcm.googleapis.com:22/fcm/send/x',
    'https://web.push.apple.com:8443/x',
    'https://push.apple.com/x',
    'https://notify.windows.com/x',
  ]) {
    expect(isPushServiceUrl(refused), refused).toBe(false);
  }
  for (const taken of [
    'https://fcm.googleapis.com/fcm/send/x',
    'https://fcm.googleapis.com:443/fcm/send/x',
    'https://updates.push.services.mozilla.com/wpush/v2/x',
    'https://web.push.apple.com/QK1',
    'https://wns2-db5p.notify.windows.com/w/?token=x',
  ]) {
    expect(isPushServiceUrl(taken), taken).toBe(true);
  }
});
