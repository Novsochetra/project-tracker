import { formatRelative, HELPER_SILENCE_MS, RUN_NOT_TAKEN, type Runner } from '@tracker/shared';

export const WATCH_LIMITS =
  'Your Mac has to be on, awake and logged in; after a restart with FileVault it waits for your password. ' +
  `If it is off, asleep or offline, a run waits ${HELPER_SILENCE_MS / 60_000} minutes, then stops with “${RUN_NOT_TAKEN}”`;

export const ALWAYS_ON =
  'To run it while your Mac is off, put it on a Linux server or in Docker: see docs/always-on-helper.md in the tracker’s repo.';

const presence = (runner: Runner, now: number): string =>
  runner.online ? 'Online' : `Last seen ${formatRelative(runner.lastSeenAt, now)}`;

export const helperDetails = (runner: Runner, now: number): string =>
  [runner.projectKeys.join(', '), presence(runner, now)].filter(Boolean).join(' · ');
