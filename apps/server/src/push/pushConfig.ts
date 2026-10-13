import type { SenderSettings } from './senderKeys';
import { signingKeyOf } from './vapidKeys';

// Push services want a way to reach whoever sends: the tracker's https address does.
const subjectOf = (publicUrl: string | null): string =>
  publicUrl?.startsWith('https://') ? publicUrl : 'mailto:tracker@localhost';

// Push services refuse any other kind of contact, so a typo fails at start, not at every push.
function checkedSubject(subject: string): string {
  const mail = /^mailto:[^@\s]+@[^@\s]+$/.test(subject);
  const web = URL.canParse(subject) && new URL(subject).protocol === 'https:';
  if (!mail && !web) {
    throw new Error('VAPID_SUBJECT must be mailto:you@example.com or an https:// address.');
  }
  return subject;
}

// Keys set in the environment win; without them the server makes its own (senderKeys.ts). A key
// set wrong stops the start, rather than every push failing later.
export function loadPushSettings(env: NodeJS.ProcessEnv, publicUrl: string | null): SenderSettings {
  const publicKey = env.VAPID_PUBLIC_KEY?.trim() ?? '';
  const privateKey = env.VAPID_PRIVATE_KEY?.trim() ?? '';
  if (Boolean(publicKey) !== Boolean(privateKey)) {
    throw new Error('Set both VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY, or neither.');
  }
  const keys = publicKey ? { publicKey, privateKey } : null;
  if (keys) signingKeyOf(keys);
  return { keys, subject: checkedSubject(env.VAPID_SUBJECT?.trim() || subjectOf(publicUrl)) };
}
