import { RUN_REQUEST_DEADLINE_MS, RUN_REQUEST_WAIT_MS } from '../../domain/runRequest';

export const requestExpiresAt = (createdAt: number): number => createdAt + RUN_REQUEST_DEADLINE_MS;

export const requestIsOverdue = (expiresAt: number, now: number): boolean => now >= expiresAt;

// A wait ends at the deadline at the latest, so an unanswered request ends as expired on time.
export const nextWaitMs = (expiresAt: number, now: number): number =>
  Math.max(0, Math.min(RUN_REQUEST_WAIT_MS, expiresAt - now));
