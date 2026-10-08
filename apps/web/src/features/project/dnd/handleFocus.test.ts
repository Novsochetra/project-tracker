import { afterEach, describe, expect, it } from 'vitest';
import { clearHandleFocus, requestHandleFocus, wantsHandleFocus } from './handleFocus';

function handleFor(ticketId: string): HTMLButtonElement {
  const handle = document.createElement('button');
  handle.setAttribute('data-handle-for', ticketId);
  document.body.append(handle);
  return handle;
}

afterEach(() => {
  clearHandleFocus();
  document.body.replaceChildren();
});

describe('handle focus requests', () => {
  it('asks only the moved ticket to take focus', () => {
    requestHandleFocus('t-1', 0);
    expect(wantsHandleFocus('t-1', 10)).toBe(true);
    expect(wantsHandleFocus('t-2', 10)).toBe(false);
  });

  it('keeps asking across renders until it expires', () => {
    requestHandleFocus('t-1', 0);
    expect(wantsHandleFocus('t-1', 500)).toBe(true);
    expect(wantsHandleFocus('t-1', 900)).toBe(true);
    expect(wantsHandleFocus('t-1', 1_001)).toBe(false);
    expect(wantsHandleFocus('t-1', 10)).toBe(false);
  });

  it('follows the latest move', () => {
    requestHandleFocus('t-1', 0);
    requestHandleFocus('t-2', 5);
    expect(wantsHandleFocus('t-1', 10)).toBe(false);
    expect(wantsHandleFocus('t-2', 10)).toBe(true);
  });

  it('keeps the request while its own handle gets focus back', () => {
    const handle = handleFor('t-1');
    requestHandleFocus('t-1', 0);
    handle.focus();
    expect(wantsHandleFocus('t-1', 10)).toBe(true);
  });

  it('gives up when focus moves somewhere else', () => {
    const search = document.createElement('input');
    document.body.append(search);
    requestHandleFocus('t-1', 0);
    search.focus();
    expect(wantsHandleFocus('t-1', 10)).toBe(false);
  });

  it('gives up on a press elsewhere', () => {
    requestHandleFocus('t-1', 0);
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(wantsHandleFocus('t-1', 10)).toBe(false);
  });
});
