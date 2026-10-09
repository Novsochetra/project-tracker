import type { KeyboardEvent } from 'react';
import { describe, expect, it } from 'vitest';
import { canSendComment, isSubmitShortcut, tooLongMessage } from './commentRules';

const key = (init: { key: string; metaKey?: boolean; ctrlKey?: boolean; isComposing?: boolean }) =>
  ({
    key: init.key,
    metaKey: init.metaKey ?? false,
    ctrlKey: init.ctrlKey ?? false,
    nativeEvent: { isComposing: init.isComposing ?? false },
  }) as unknown as KeyboardEvent;

describe('canSendComment', () => {
  it('needs text or an uploaded image', () => {
    expect(canSendComment('', 0, 0)).toBe(false);
    expect(canSendComment('  \n ', 0, 0)).toBe(false);
    expect(canSendComment('Looks good', 0, 0)).toBe(true);
    expect(canSendComment('', 1, 0)).toBe(true);
  });

  it('waits for uploads so no image is left behind', () => {
    expect(canSendComment('Looks good', 1, 1)).toBe(false);
  });
});

describe('isSubmitShortcut', () => {
  it('is Cmd+Enter or Ctrl+Enter', () => {
    expect(isSubmitShortcut(key({ key: 'Enter', metaKey: true }))).toBe(true);
    expect(isSubmitShortcut(key({ key: 'Enter', ctrlKey: true }))).toBe(true);
    expect(isSubmitShortcut(key({ key: 'Enter' }))).toBe(false);
    expect(isSubmitShortcut(key({ key: 'a', metaKey: true }))).toBe(false);
  });

  it('leaves Enter to an input method that is composing', () => {
    expect(isSubmitShortcut(key({ key: 'Enter', metaKey: true, isComposing: true }))).toBe(false);
  });
});

describe('tooLongMessage', () => {
  it('is null up to the limit and names both lengths past it', () => {
    expect(tooLongMessage('x'.repeat(20_000))).toBeNull();
    expect(tooLongMessage('x'.repeat(20_001))).toBe(
      'A comment can be up to 20,000 characters. This one has 20,001: shorten it to send it.',
    );
  });
});
