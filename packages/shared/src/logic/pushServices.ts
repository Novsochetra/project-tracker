// The server posts to a subscription's address, so only the browsers' own push services may be one:
// any other address would let a signed-in person make the server reach into its own network.
const PUSH_SERVICE_HOSTS = [
  'push.apple.com',
  'googleapis.com',
  'mozilla.com',
  'notify.windows.com',
];

export function isPushServiceUrl(text: string): boolean {
  if (!URL.canParse(text)) return false;
  const url = new URL(text);
  return (
    url.protocol === 'https:' &&
    PUSH_SERVICE_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`))
  );
}
