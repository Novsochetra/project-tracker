// Null without a service worker (the dev server, a browser without push).
export async function pushManager(): Promise<PushManager | null> {
  if (
    !('serviceWorker' in navigator) ||
    typeof PushManager === 'undefined' ||
    typeof Notification === 'undefined'
  ) {
    return null;
  }
  const registration = await navigator.serviceWorker.getRegistration();
  return registration?.pushManager ?? null;
}
