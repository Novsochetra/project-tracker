// navigator.onLine false is only a hint: WebKit has kept it false for 20 minutes after a network
// change while every request was answered (PT-179). So it makes the tracker unreachable until an
// answer says otherwise, and the banner's rechecks ask for one.
export function onOfflineHint(target: Window, hint: () => void): () => void {
  if (target.navigator.onLine === false) hint();
  target.addEventListener('offline', hint);
  return () => target.removeEventListener('offline', hint);
}
