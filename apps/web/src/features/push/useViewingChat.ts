import { useEffect } from 'react';
import { useApi } from '../../api';
import { useOptionalScreen } from '../../navigation';

// The tracker forgets a device it stops hearing from after 35 s (VIEWING_MS on the server), so a
// phone locked before it could say it left gets the chat's pushes again soon.
export const VIEWING_REPEAT_MS = 15_000;

const pushAllowed = () =>
  typeof Notification !== 'undefined' && Notification.permission === 'granted';

// While this chat is the screen in front, its pushes skip this device.
export function useViewingChat(chatId: string | null): void {
  const client = useApi();
  const inFront = useOptionalScreen()?.isTop ?? true;
  const shown = inFront ? chatId : null;
  useEffect(() => {
    if (shown === null || !pushAllowed()) return;
    const say = (id: string | null) => void client.viewChat(id).catch(() => undefined);
    let timer: ReturnType<typeof setInterval> | undefined;
    const update = () => {
      clearInterval(timer);
      const visible = document.visibilityState === 'visible';
      say(visible ? shown : null);
      if (visible) timer = setInterval(() => say(shown), VIEWING_REPEAT_MS);
    };
    update();
    document.addEventListener('visibilitychange', update);
    return () => {
      document.removeEventListener('visibilitychange', update);
      clearInterval(timer);
      say(null);
    };
  }, [client, shown]);
}
