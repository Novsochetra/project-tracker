import { ApiError } from '@tracker/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  errorMessage,
  FALLBACK_ERROR_MESSAGE,
  isClientError,
  isNetworkError,
  isNotFound,
  isUnauthorized,
  NETWORK_ERROR_MESSAGE,
} from './errors';

describe('errorMessage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows the server message for API errors', () => {
    expect(errorMessage(new ApiError(400, 'invalid_input', 'Add a title.'))).toBe('Add a title.');
    expect(errorMessage(new ApiError(500, 'internal', 'Database is locked.'))).toBe(
      'Database is locked.',
    );
  });

  it('explains network failures', () => {
    expect(errorMessage(new TypeError('Failed to fetch'))).toBe(NETWORK_ERROR_MESSAGE);
    expect(errorMessage(new ApiError(502, 'http_error', 'Bad Gateway'))).toBe(
      NETWORK_ERROR_MESSAGE,
    );
    expect(errorMessage(new ApiError(500, 'http_error', 'Internal Server Error'))).toBe(
      NETWORK_ERROR_MESSAGE,
    );
  });

  it('explains failures while the browser is offline', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    expect(errorMessage(new Error('aborted'))).toBe(NETWORK_ERROR_MESSAGE);
    expect(errorMessage(new ApiError(409, 'conflict', 'Name taken.'))).toBe('Name taken.');
  });

  it('falls back for anything else', () => {
    expect(errorMessage(new SyntaxError('Unexpected token'))).toBe(FALLBACK_ERROR_MESSAGE);
    expect(errorMessage('boom')).toBe(FALLBACK_ERROR_MESSAGE);
    expect(errorMessage(new ApiError(418, 'teapot', ''))).toBe(FALLBACK_ERROR_MESSAGE);
  });
});

describe('error checks', () => {
  it('recognizes status codes', () => {
    expect(isUnauthorized(new ApiError(401, 'unauthorized', 'x'))).toBe(true);
    expect(isUnauthorized(new Error('x'))).toBe(false);
    expect(isNotFound(new ApiError(404, 'not_found', 'x'))).toBe(true);
    expect(isClientError(new ApiError(422, 'no_match', 'x'))).toBe(true);
    expect(isClientError(new ApiError(503, 'http_error', 'x'))).toBe(false);
  });
});

describe('isNetworkError', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('recognizes requests that never reached the server', () => {
    expect(isNetworkError(new TypeError('Failed to fetch'))).toBe(true);
    expect(isNetworkError(new ApiError(502, 'http_error', 'Bad Gateway'))).toBe(true);
    expect(isNetworkError(new ApiError(504, 'http_error', 'Gateway Timeout'))).toBe(true);
  });

  it('counts any other failure while the browser is offline', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    expect(isNetworkError(new Error('aborted'))).toBe(true);
    expect(isNetworkError(new ApiError(409, 'conflict', 'Name taken.'))).toBe(false);
  });

  it('leaves out answers from the server and other errors', () => {
    expect(isNetworkError(new ApiError(500, 'internal', 'Database is locked.'))).toBe(false);
    expect(isNetworkError(new ApiError(404, 'not_found', 'x'))).toBe(false);
    expect(isNetworkError(new SyntaxError('Unexpected token'))).toBe(false);
    expect(isNetworkError('boom')).toBe(false);
  });
});
