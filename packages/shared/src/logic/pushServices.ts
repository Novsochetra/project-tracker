// The server posts to a subscription's address, so only the browsers' own push services may be one:
// any other address would let a signed-in person make the server reach into its own network.
const PUSH_SERVICE_HOSTS = ['fcm.googleapis.com'];
const PUSH_SERVICE_DOMAINS = [
  '.push.services.mozilla.com',
  '.push.apple.com',
  '.notify.windows.com',
];

const isPushHost = (host: string): boolean =>
  PUSH_SERVICE_HOSTS.includes(host) || PUSH_SERVICE_DOMAINS.some((domain) => host.endsWith(domain));

// An empty port is https's own: URL drops an explicit :443.
export function isPushServiceUrl(text: string): boolean {
  if (!URL.canParse(text)) return false;
  const url = new URL(text);
  return (
    url.protocol === 'https:' &&
    url.port === '' &&
    !url.username &&
    !url.password &&
    isPushHost(url.hostname)
  );
}
