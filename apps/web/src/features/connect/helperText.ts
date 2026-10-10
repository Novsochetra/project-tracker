import { formatRelative, type Runner } from '@tracker/shared';

const presence = (runner: Runner, now: number): string =>
  runner.online ? 'Online' : `Last seen ${formatRelative(runner.lastSeenAt, now)}`;

export const helperDetails = (runner: Runner, now: number): string =>
  [runner.projectKeys.join(', '), presence(runner, now)].filter(Boolean).join(' · ');
