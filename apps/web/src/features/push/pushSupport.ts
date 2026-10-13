export type PushSupport = 'ready' | 'home-screen' | 'unsupported' | 'blocked';

export interface PushEnvironment {
  canPush: boolean;
  permission: NotificationPermission | null;
  ios: boolean;
  standalone: boolean;
}

// Safari on iPhone has push only for an app opened from the Home Screen.
export function pushSupportOf({
  canPush,
  permission,
  ios,
  standalone,
}: PushEnvironment): PushSupport {
  if (!canPush) return ios && !standalone ? 'home-screen' : 'unsupported';
  return permission === 'denied' ? 'blocked' : 'ready';
}
