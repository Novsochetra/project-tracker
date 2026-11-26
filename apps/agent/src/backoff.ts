import { ApiError } from '@tracker/client';

const FIRST_MS = 1_000;
const LONGEST_MS = 15_000;

export const retryDelay = (attempt: number): number =>
  Math.min(FIRST_MS * 2 ** attempt, LONGEST_MS);

export const worthRetrying = (error: unknown): boolean =>
  !(error instanceof ApiError) || error.status >= 500 || error.status === 429;
