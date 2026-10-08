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
    requestHandleFocus('t-1');
    expect(wantsHandleFocus('t-1')).toBe(true);
    expect(wantsHandleFocus('t-2')).toBe(false);
  });

  it('keeps asking across renders until the move is over', () => {
    const moveOver = requestHandleFocus('t-1');
    expect(wantsHandleFocus('t-1')).toBe(true);
    expect(wantsHandleFocus('t-1')).toBe(true);
    moveOver();
    expect(wantsHandleFocus('t-1')).toBe(false);
  });

  it('follows the latest move', () => {
    requestHandleFocus('t-1');
    requestHandleFocus('t-2');
    expect(wantsHandleFocus('t-1')).toBe(false);
    expect(wantsHandleFocus('t-2')).toBe(true);
  });

  it('keeps the latest move of the same ticket asking when an earlier one ends', () => {
    const firstOver = requestHandleFocus('t-1');
    requestHandleFocus('t-1');
    firstOver();
    expect(wantsHandleFocus('t-1')).toBe(true);
  });

  it('keeps the request while its own handle gets focus back', () => {
    const handle = handleFor('t-1');
    requestHandleFocus('t-1');
    handle.focus();
    expect(wantsHandleFocus('t-1')).toBe(true);
  });

  it('gives up when focus moves somewhere else', () => {
    const search = document.createElement('input');
    document.body.append(search);
    requestHandleFocus('t-1');
    search.focus();
    expect(wantsHandleFocus('t-1')).toBe(false);
  });

  it('gives up on a press elsewhere', () => {
    requestHandleFocus('t-1');
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(wantsHandleFocus('t-1')).toBe(false);
  });
});
