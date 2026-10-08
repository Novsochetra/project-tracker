import { describe, expect, it } from 'vitest';
import {
  addedToast,
  createInputOf,
  droppedToast,
  hasContent,
  newCaptureId,
  toQueuedCapture,
} from './captureForm';

describe('capture form', () => {
  it('turns typed values into a queued capture with trimmed text', () => {
    expect(
      toQueuedCapture({
        id: 'c-1',
        projectKey: 'MOB',
        values: { title: '  Fix login ', description: ' On iOS\n', priority: 'high' },
        capturedAt: 42,
      }),
    ).toEqual({
      id: 'c-1',
      projectKey: 'MOB',
      title: 'Fix login',
      description: 'On iOS',
      priority: 'high',
      capturedAt: 42,
      attempted: false,
    });
  });

  it('leaves the status to the server, which uses the first status', () => {
    const input = createInputOf({ title: 'Idea', description: '', priority: 'medium' });
    expect(input).toEqual({ title: 'Idea', description: '', priority: 'medium' });
  });

  it('attaches uploaded photos', () => {
    const input = createInputOf({ title: 'Idea', description: '', priority: 'low' }, ['img-1']);
    expect(input.attachmentIds).toEqual(['img-1']);
  });

  it('counts tickets added in words', () => {
    expect(addedToast(1)).toBe('1 ticket added');
    expect(addedToast(3)).toBe('3 tickets added');
    expect(droppedToast('Idea', 'Project OLD was not found.')).toBe(
      "Couldn't add “Idea”. Project OLD was not found.",
    );
  });

  it('has content once anything is typed or attached', () => {
    const blank = { title: ' ', description: '', priority: 'medium' } as const;
    expect(hasContent(blank, 0)).toBe(false);
    expect(hasContent({ ...blank, description: 'x' }, 0)).toBe(true);
    expect(hasContent(blank, 1)).toBe(true);
  });

  it('makes ids without randomUUID, which plain http lacks', () => {
    Object.defineProperty(crypto, 'randomUUID', { configurable: true, value: undefined });
    try {
      const ids = new Set([newCaptureId(), newCaptureId()]);
      expect(ids.size).toBe(2);
      for (const id of ids) expect(id).toMatch(/^[0-9a-f]{32}$/);
    } finally {
      Reflect.deleteProperty(crypto, 'randomUUID');
    }
  });
});
