import type { PushSupport } from './pushSupport';

export const PUSH_NOTES: Record<PushSupport, string> = {
  ready: 'Tells you when Claude finishes, answers or needs you, also while the app is closed.',
  'home-screen':
    'On iPhone this works once Tracker is on the Home Screen: tap Share, then Add to Home Screen, and open it from there.',
  unsupported: "This browser can't show notifications.",
  blocked: 'Notifications are blocked for Tracker. Allow them in Settings, then try again.',
};
