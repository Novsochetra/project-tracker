import { describe, expect, it } from 'vitest';
import { savedAnswerPlugin } from './savedAnswerPlugin';
import { isSavedAnswer } from './savedAnswers';

const answer = (body: string | null, status = 200, contentType = 'application/json') =>
  new Response(body, { status, headers: contentType ? { 'content-type': contentType } : {} });

const { cachedResponseWillBeUsed, fetchDidSucceed } = savedAnswerPlugin;

describe('savedAnswerPlugin', () => {
  it('marks an answer taken from the cache, so the app can tell it from the server', async () => {
    const saved = await cachedResponseWillBeUsed({ cachedResponse: answer('[1,2]') });

    expect(saved && isSavedAnswer(saved)).toBe(true);
    expect(saved?.status).toBe(200);
    expect(saved?.headers.get('content-type')).toBe('application/json');
    expect(await saved?.json()).toEqual([1, 2]);
  });

  it('leaves a cache miss a miss', async () => {
    expect(await cachedResponseWillBeUsed({})).toBeNull();
  });

  it('turns a bare 5xx from a proxy in front of a stopped API into a failed request', async () => {
    await expect(fetchDidSucceed({ response: answer('', 502, 'text/plain') })).rejects.toThrow();
    await expect(fetchDidSucceed({ response: answer(null, 500, '') })).rejects.toThrow();
  });

  it('passes on every answer the API gave itself, unmarked', async () => {
    const answers = [
      answer('[]'),
      answer('{"error":{"code":"not_found","message":"Not found"}}', 404),
      answer('{"error":{"code":"internal","message":"Locked"}}', 500),
    ];
    for (const response of answers) {
      const passed = await fetchDidSucceed({ response });
      expect(passed).toBe(response);
      expect(isSavedAnswer(passed)).toBe(false);
    }
  });
});
