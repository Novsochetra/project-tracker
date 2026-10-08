import { ApiError } from '@tracker/client';
import type { Ticket } from '@tracker/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NETWORK_ERROR_MESSAGE } from '../../api';
import { deferred } from '../../api/test/deferred';
import type { QueuedCapture } from './captureQueue';
import { submitCapture, type CaptureDraft, type SubmitDeps } from './submitCapture';

const capture: QueuedCapture = {
  id: 'c-1',
  projectKey: 'MOB',
  title: 'Idea',
  description: '',
  priority: 'medium',
  capturedAt: 1,
};

const ticket = { key: 'MOB-7' } as Ticket;
const NETWORK_DOWN = new TypeError('Failed to fetch');
const TIMEOUT_MS = 8_000;

const draft = (attachmentIds: string[] = []): CaptureDraft => ({ capture, attachmentIds });

function deps(create: SubmitDeps['create'], overrides: Partial<SubmitDeps> = {}) {
  const untrack = vi.fn();
  const result = {
    create: vi.fn(create),
    save: vi.fn(() => true),
    track: vi.fn(() => untrack),
    onLateResult: vi.fn(),
    timeoutMs: TIMEOUT_MS,
    ...overrides,
  } satisfies SubmitDeps;
  return { ...result, untrack };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('submitCapture', () => {
  it('creates the ticket and saves nothing on the device', async () => {
    const sent = deps(() => Promise.resolve(ticket));
    await expect(submitCapture(draft(['img-1']), sent)).resolves.toEqual({
      kind: 'created',
      ticket,
    });
    expect(sent.create).toHaveBeenCalledWith(draft(['img-1']));
    expect(sent.save).not.toHaveBeenCalled();
    expect(sent.untrack).toHaveBeenCalledTimes(1);
  });

  it('saves the text on the device when the tracker cannot be reached', async () => {
    const sent = deps(() => Promise.reject(NETWORK_DOWN));
    await expect(submitCapture(draft(), sent)).resolves.toEqual({ kind: 'saved' });
    // Whether or not the request reached the tracker, the queued copy keeps the capture's id.
    expect(sent.save).toHaveBeenCalledWith(capture);
  });

  it('keeps a capture with photos in the sheet, since photos need a connection', async () => {
    const sent = deps(() => Promise.reject(NETWORK_DOWN));
    await expect(submitCapture(draft(['img-1']), sent)).resolves.toEqual({
      kind: 'needsConnection',
    });
    expect(sent.save).not.toHaveBeenCalled();
  });

  it('shows the answer when the server refuses the ticket', async () => {
    const sent = deps(() =>
      Promise.reject(new ApiError(404, 'not_found', 'Project MOB was not found.')),
    );
    await expect(submitCapture(draft(), sent)).resolves.toEqual({
      kind: 'failed',
      message: 'Project MOB was not found.',
    });
    expect(sent.save).not.toHaveBeenCalled();
  });

  it('says so when the device cannot keep the capture either', async () => {
    const sent = deps(() => Promise.reject(NETWORK_DOWN), { save: vi.fn(() => false) });
    await expect(submitCapture(draft(), sent)).resolves.toEqual({
      kind: 'failed',
      message: NETWORK_ERROR_MESSAGE,
    });
  });

  it('saves a slow capture on the device and marks it created when the request lands', async () => {
    vi.useFakeTimers();
    const answer = deferred<Ticket>();
    const sent = deps(() => answer.promise);

    const outcome = submitCapture(draft(), sent);
    await vi.advanceTimersByTimeAsync(TIMEOUT_MS);

    await expect(outcome).resolves.toEqual({ kind: 'saved' });
    expect(sent.save).toHaveBeenCalledWith(capture);
    expect(sent.untrack).not.toHaveBeenCalled();

    answer.resolve(ticket);
    await vi.waitFor(() => expect(sent.onLateResult).toHaveBeenCalledWith(capture, ticket));
    expect(sent.untrack).toHaveBeenCalledTimes(1);
  });

  it('leaves a slow capture queued when its request fails after all', async () => {
    vi.useFakeTimers();
    const answer = deferred<Ticket>();
    const sent = deps(() => answer.promise);

    const outcome = submitCapture(draft(), sent);
    await vi.advanceTimersByTimeAsync(TIMEOUT_MS);
    await outcome;
    answer.reject(NETWORK_DOWN);

    await vi.waitFor(() => expect(sent.onLateResult).toHaveBeenCalledWith(capture, null));
    expect(sent.untrack).toHaveBeenCalledTimes(1);
  });

  it('waits for photos however long it takes, since they cannot wait on the device', async () => {
    vi.useFakeTimers();
    const answer = deferred<Ticket>();
    const sent = deps(() => answer.promise);

    const outcome = submitCapture(draft(['img-1']), sent);
    await vi.advanceTimersByTimeAsync(TIMEOUT_MS * 3);
    expect(sent.save).not.toHaveBeenCalled();

    answer.resolve(ticket);
    await expect(outcome).resolves.toEqual({ kind: 'created', ticket });
  });

  it('waits for the answer when a slow capture cannot be kept on the device', async () => {
    vi.useFakeTimers();
    const answer = deferred<Ticket>();
    const sent = deps(() => answer.promise, { save: vi.fn(() => false) });

    const outcome = submitCapture(draft(), sent);
    await vi.advanceTimersByTimeAsync(TIMEOUT_MS);
    answer.resolve(ticket);

    await expect(outcome).resolves.toEqual({ kind: 'created', ticket });
    expect(sent.onLateResult).not.toHaveBeenCalled();
  });

  it('tracks the capture as sending until its request settles', async () => {
    const answer = deferred<Ticket>();
    const sent = deps(() => answer.promise);
    const outcome = submitCapture(draft(), sent);
    expect(sent.track).toHaveBeenCalledWith('c-1');
    expect(sent.untrack).not.toHaveBeenCalled();
    answer.resolve(ticket);
    await outcome;
    expect(sent.untrack).toHaveBeenCalledTimes(1);
  });
});
