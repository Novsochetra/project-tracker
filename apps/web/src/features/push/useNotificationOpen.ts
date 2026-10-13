import { useEffect } from 'react';
import { useLatest } from '../../lib/useLatest';
import { useNavigation } from '../../navigation';
import { openPathOf } from '../../pwa/push/openMessage';

// A tapped notification brings this window forward and names the page to show (pwa/push).
export function useNotificationOpen(): void {
  const push = useLatest(useNavigation().push);
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const worker = navigator.serviceWorker;
    const onMessage = (event: MessageEvent) => {
      const path = openPathOf(event.data);
      if (path) push.current(path);
    };
    worker.addEventListener('message', onMessage);
    return () => worker.removeEventListener('message', onMessage);
  }, [push]);
}
