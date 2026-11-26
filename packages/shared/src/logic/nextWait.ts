import { QUESTION_WAIT_MS } from '../domain/ticketQuestion';

// A wait ends at the deadline at the latest, so an unanswered question ends as expired on time.
export const nextWaitMs = (expiresAt: number, now: number): number =>
  Math.max(0, Math.min(QUESTION_WAIT_MS, expiresAt - now));
