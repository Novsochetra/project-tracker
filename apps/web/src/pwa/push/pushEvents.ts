import { notificationOf, pathOfNotification } from './notification';
import { openInApp } from './openWindow';
import type { PushScope } from './workerTypes';

export function listenForPushes(scope: PushScope): void {
  scope.addEventListener('push', (event) => {
    const { title, options } = notificationOf(() => event.data?.json());
    event.waitUntil(scope.registration.showNotification(title, options));
  });
  scope.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const path = pathOfNotification(event.notification.data);
    event.waitUntil(openInApp(scope.clients, scope.location.origin, path));
  });
}
