// Refused rather than warned about: the MCP server's warnings land in a log nobody reads, and the
// http address of an https tracker (Railway) redirects, which drops the token, so it could not work
// anyway. A tracker on this computer is plain http and its requests never leave the machine.
export class PlainHttpError extends Error {
  override name = 'PlainHttpError';
}

const isLoopback = (hostname: string): boolean =>
  hostname === 'localhost' ||
  hostname.endsWith('.localhost') ||
  hostname === '[::1]' ||
  /^127\.\d+\.\d+\.\d+$/.test(hostname);

function sendsInTheClear(url: string): boolean {
  try {
    const { protocol, hostname } = new URL(url);
    return protocol === 'http:' && !isLoopback(hostname);
  } catch {
    // Not a URL: the request fails on its own and says so, before any token is sent.
    return false;
  }
}

export const plainHttpProblem = (url: string): string | undefined =>
  sendsInTheClear(url)
    ? `Not sending an API token to ${url}: on plain http anyone on the network can read it. ` +
      "Use the tracker's https:// address. Only a tracker on this computer (localhost) gets a token over http."
    : undefined;
