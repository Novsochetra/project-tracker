import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  lastAnswerWasSaved,
  noteAnswer,
  SAVED_ANSWER_HEADER,
  subscribeSavedAnswers,
  watchSavedAnswers,
} from './savedAnswers';

const fromNetwork = () => new Response('[]');
const fromCache = () => new Response('[]', { headers: { [SAVED_ANSWER_HEADER]: '1' } });

const scopeAnswering = (...answers: Array<() => Response>) => ({
  fetch: vi.fn<typeof fetch>(() => Promise.resolve((answers.shift() ?? fromNetwork)())),
});

let stops: Array<() => void> = [];

afterEach(() => {
  stops.forEach((stop) => stop());
  stops = [];
  noteAnswer(fromNetwork());
});

describe('noteAnswer', () => {
  it('remembers whether the latest answer came from the service worker cache', () => {
    noteAnswer(fromCache());
    expect(lastAnswerWasSaved()).toBe(true);

    noteAnswer(fromNetwork());
    expect(lastAnswerWasSaved()).toBe(false);
  });

  it('tells listeners only about changes', () => {
    const listener = vi.fn();
    stops.push(subscribeSavedAnswers(listener));

    noteAnswer(fromCache());
    noteAnswer(fromCache());
    expect(listener).toHaveBeenCalledTimes(1);

    noteAnswer(fromNetwork());
    expect(listener).toHaveBeenCalledTimes(2);
  });
});

describe('watchSavedAnswers', () => {
  it('notes every answer that passes through fetch and hands it on untouched', async () => {
    const scope = scopeAnswering(fromCache, fromNetwork);
    const original = scope.fetch;
    stops.push(watchSavedAnswers(scope));

    const saved = await scope.fetch('/api/projects');
    expect(lastAnswerWasSaved()).toBe(true);
    expect(await saved.json()).toEqual([]);

    await scope.fetch('/api/projects', { method: 'GET' });
    expect(lastAnswerWasSaved()).toBe(false);
    expect(original).toHaveBeenNthCalledWith(2, '/api/projects', { method: 'GET' });
  });

  it('leaves the note alone when a request gets no answer at all', async () => {
    const scope = {
      fetch: vi.fn<typeof fetch>(() => Promise.reject(new TypeError('Failed to fetch'))),
    };
    stops.push(watchSavedAnswers(scope));
    noteAnswer(fromCache());

    await expect(scope.fetch('/api/projects')).rejects.toThrow('Failed to fetch');

    expect(lastAnswerWasSaved()).toBe(true);
  });

  it('puts the original fetch back once stopped', async () => {
    const scope = scopeAnswering(fromCache);
    const original = scope.fetch;
    watchSavedAnswers(scope)();

    expect(scope.fetch).toBe(original);
    await scope.fetch('/api/projects');
    expect(lastAnswerWasSaved()).toBe(false);
  });
});
