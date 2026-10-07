import { describe, expect, it } from 'vitest';
import { ApiError, TrackerClient } from '../../src';

const clientAnswering = (body: string) =>
  new TrackerClient({
    baseUrl: '',
    fetch: () => Promise.resolve(new Response(body, { status: 502, statusText: 'Bad Gateway' })),
  });

describe('error responses whose error field is not { code, message }', () => {
  it.each(['{"error":null}', '{"error":"Bad gateway"}', '{"error":{"message":"No code"}}'])(
    '%s rejects with an ApiError coded http_error',
    async (body) => {
      const error = await clientAnswering(body)
        .listProjects()
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(ApiError);
      expect(error).toMatchObject({ status: 502, code: 'http_error', message: 'Bad Gateway' });
    },
  );
});
