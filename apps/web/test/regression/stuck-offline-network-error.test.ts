import { ApiError } from '@tracker/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { errorMessage, isNetworkError, NETWORK_ERROR_MESSAGE } from '../../src/api';

// WebKit kept navigator.onLine false for 20 minutes while every request was answered (PT-179), and
// every failure that wasn't the server's own answer was taken for a lost connection.

beforeEach(() => {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
});

afterEach(() => {
  vi.restoreAllMocks();
});

it('takes only a failed request for a lost connection while the browser says it is offline', () => {
  expect(isNetworkError(new SyntaxError('Unexpected token'))).toBe(false);
  expect(isNetworkError(new Error('aborted'))).toBe(false);
  expect(errorMessage(new Error('aborted'))).not.toBe(NETWORK_ERROR_MESSAGE);
  expect(isNetworkError(new TypeError('Load failed'))).toBe(true);
  expect(isNetworkError(new ApiError(502, 'http_error', 'Bad Gateway'))).toBe(true);
});
