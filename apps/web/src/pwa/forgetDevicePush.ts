// Signed out, this device gets nothing more; the next person to sign in turns it on for themselves.
export async function forgetDevicePush(): Promise<void> {
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    await (await registration?.pushManager.getSubscription())?.unsubscribe();
  } catch {
    // No service worker or no push here: nothing was sent to this device.
  }
}
