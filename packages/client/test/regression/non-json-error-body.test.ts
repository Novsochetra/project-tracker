import { describe, expect, it } from 'vitest';
import { ApiError, TrackerClient } from '../../src';

const clientAnswering = (response: Response) =>
  new TrackerClient({ baseUrl: '', fetch: () => Promise.resolve(response) });

describe('error responses with a non-JSON body', () => {
  it('reject with an ApiError instead of a JSON SyntaxError', async () => {
    const client = clientAnswering(
      new Response('<html>Bad gateway</html>', { status: 502, statusText: 'Bad Gateway' }),
    );

    const error = await client.listProjects().catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 502, code: 'http_error', message: 'Bad Gateway' });
  });

  it('reject with an ApiError when fetching a raw attachment fails', async () => {
    const client = clientAnswering(
      new Response('Not found', { status: 404, statusText: 'Not Found' }),
    );

    await expect(client.fetchAttachment('a1')).rejects.toMatchObject({
      name: 'ApiError',
      status: 404,
      code: 'http_error',
    });
  });
});
