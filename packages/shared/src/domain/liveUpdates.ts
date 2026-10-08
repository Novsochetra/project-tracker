// GET /api/events sends a named `ping` event this often, since browsers never hand SSE comments to
// the page.
export const HEARTBEAT_MS = 15_000;

// The web app reopens a stream that stays silent this long: two missed pings plus some slack. A
// proxy can keep the browser's side of a stream open after the API server crashes.
export const LIVE_STALE_MS = 2 * HEARTBEAT_MS + 5_000;
