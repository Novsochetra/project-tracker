import { ApiError } from '@tracker/client';
import { describe, expect, it } from 'vitest';
import { NETWORK_ERROR_MESSAGE } from '../../api';
import {
  NOT_SAVED_MESSAGE,
  TOO_BIG_FOR_SERVER_MESSAGE,
  TOO_SLOW_MESSAGE,
  uploadFailureReason,
} from './uploadFailure';

describe('uploadFailureReason', () => {
  it('puts the bare answers of Node and proxies in plain words', () => {
    expect(uploadFailureReason(new ApiError(408, 'http_error', 'Request Timeout'))).toBe(
      TOO_SLOW_MESSAGE,
    );
    expect(uploadFailureReason(new ApiError(413, 'http_error', 'Payload Too Large'))).toBe(
      TOO_BIG_FOR_SERVER_MESSAGE,
    );
  });

  it("says a bare 5xx wasn't saved: from a stopped API's proxy, or the tracker's own", () => {
    expect(uploadFailureReason(new ApiError(500, 'http_error', 'Internal Server Error'))).toBe(
      NOT_SAVED_MESSAGE,
    );
    expect(uploadFailureReason(new ApiError(502, 'http_error', 'Bad Gateway'))).toBe(
      NOT_SAVED_MESSAGE,
    );
    expect(uploadFailureReason(new ApiError(500, 'internal', 'Database is locked.'))).toBe(
      'Database is locked.',
    );
  });

  it("keeps the tracker's own words and the network message", () => {
    const refused = new ApiError(400, 'invalid_input', 'Images can be up to 15 MB.');
    expect(uploadFailureReason(refused)).toBe('Images can be up to 15 MB.');
    expect(uploadFailureReason(new TypeError('Failed to fetch'))).toBe(NETWORK_ERROR_MESSAGE);
  });
});
