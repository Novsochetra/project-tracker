import { isApiError } from '../../api/errors';

// Another device answered first, or the request ended: the re-read shows how, so no error shows.
// A 404 (the run is gone) is no such answer: its cards go, and the toast says why.
export const isSettledElsewhere = (error: unknown): boolean =>
  isApiError(error) && error.status === 409;
