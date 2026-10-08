import { errorMessage, NETWORK_ERROR_MESSAGE } from '../api';

export const isApiUnreachable = (online: boolean, error: Error | null): boolean =>
  !online || (error !== null && errorMessage(error) === NETWORK_ERROR_MESSAGE);
