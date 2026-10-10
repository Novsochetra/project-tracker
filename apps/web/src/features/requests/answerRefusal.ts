import { isApiError } from '../../api/errors';

// Another device answered first, or the request ended: the re-read shows how, so no error shows.
export const isSettledElsewhere = (error: unknown): boolean =>
  isApiError(error) && (error.status === 409 || error.status === 404);
