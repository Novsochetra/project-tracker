import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setupApi } from '../../api/test/render';
import { VIEWING_REPEAT_MS, useViewingChat } from './useViewingChat';

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
}

function renderViewing(chatId: string | null, permission: NotificationPermission = 'granted') {
  vi.stubGlobal('Notification', { permission });
  const api = setupApi({ viewChat: vi.fn().mockResolvedValue(undefined) });
  const view = renderHook(({ id }) => useViewingChat(id), {
    wrapper: api.wrapper,
    initialProps: { id: chatId },
  });
  return { ...view, viewChat: api.client.viewChat as ReturnType<typeof vi.fn> };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(document, 'visibilityState');
});

describe('useViewingChat', () => {
  it('tells the tracker the chat on screen, again while it stays, and when it goes', () => {
    vi.useFakeTimers();
    const { viewChat, unmount } = renderViewing('c-1');
    expect(viewChat.mock.calls).toEqual([['c-1']]);
    act(() => void vi.advanceTimersByTime(VIEWING_REPEAT_MS));
    expect(viewChat.mock.calls).toEqual([['c-1'], ['c-1']]);
    unmount();
    expect(viewChat).toHaveBeenLastCalledWith(null);
  });

  it('says none while the app is hidden, and the chat when it shows again', () => {
    const { viewChat } = renderViewing('c-1');
    act(() => setVisibility('hidden'));
    expect(viewChat).toHaveBeenLastCalledWith(null);
    act(() => setVisibility('visible'));
    expect(viewChat).toHaveBeenLastCalledWith('c-1');
  });

  it('says nothing for a new chat or while notifications are not allowed', () => {
    expect(renderViewing(null).viewChat).not.toHaveBeenCalled();
    expect(renderViewing('c-1', 'default').viewChat).not.toHaveBeenCalled();
  });
});
