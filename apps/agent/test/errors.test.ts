import { ApiError } from '@tracker/client';
import { describe, expect, it } from 'vitest';
import { describeError } from '../src/errors';

const URL = 'https://tracker.up.railway.app';
const refused = () => new ApiError(401, 'unauthorized', 'Sign in to use this tracker.');

describe('describeError for a 401', () => {
  it('says the tracker needs a token and how to get one', () => {
    expect(describeError(refused(), { trackerUrl: URL })).toBe(
      `The tracker at ${URL} needs an API token. Create one in the app: Connect Claude Code → API tokens. ` +
        `Then run "tracker login --url ${URL}" and paste it, or set TRACKER_API_TOKEN.`,
    );
  });

  it('names the refused token’s source and where the new one goes', () => {
    const saved = describeError(refused(), { trackerUrl: URL, tokenSource: 'tracker login' });
    expect(saved).toBe(
      `The tracker at ${URL} refused the token saved by tracker login: it was revoked, mistyped or made for another tracker. ` +
        `Create one in the app: Connect Claude Code → API tokens. Then run "tracker login --url ${URL}" and paste the new one.`,
    );
    expect(describeError(refused(), { trackerUrl: URL, tokenSource: 'TRACKER_TOKEN' })).toContain(
      `refused the token in TRACKER_TOKEN: it was revoked, mistyped or made for another tracker. Create one in the app: Connect Claude Code → API tokens. Then set TRACKER_TOKEN to the new one, or unset it and run "tracker login --url ${URL}".`,
    );
    expect(describeError(refused(), { tokenSource: '--token' })).toMatch(
      /^The tracker refused the token from --token: .* Then pass the new one\.$/,
    );
  });
});

describe('describeError for other answers', () => {
  it("keeps the tracker's own message for a 403", () => {
    const error = new ApiError(403, 'forbidden', 'Only a person can move tickets to Done.');
    expect(describeError(error, { trackerUrl: URL })).toBe(
      'Only a person can move tickets to Done.',
    );
  });

  it('says a bare 403 or 404 came from something that is not the tracker', () => {
    const forbidden = new ApiError(403, 'http_error', 'Forbidden');
    expect(describeError(forbidden, { trackerUrl: URL })).toBe(
      `The tracker at ${URL} answered HTTP 403 Forbidden. Check that TRACKER_URL (or --url) is the tracker's address.`,
    );
    expect(describeError(new ApiError(404, 'http_error', ''), { trackerUrl: URL })).toBe(
      `The tracker at ${URL} answered HTTP 404. Check that TRACKER_URL (or --url) is the tracker's address.`,
    );
  });

  it('asks to wait after a 429', () => {
    const bare = new ApiError(429, 'http_error', 'Too Many Requests');
    expect(describeError(bare, { trackerUrl: URL })).toBe(
      `The tracker at ${URL} is getting too many requests (HTTP 429). Wait a minute, then try again.`,
    );
    const told = new ApiError(
      429,
      'rate_limited',
      'Too many sign-in attempts. Try again in 3 minutes.',
    );
    expect(describeError(told)).toBe(
      'The tracker is getting too many requests (HTTP 429). Too many sign-in attempts. Try again in 3 minutes.',
    );
    const plain = new ApiError(429, 'rate_limited', 'Slow down.');
    expect(describeError(plain)).toBe(
      'The tracker is getting too many requests (HTTP 429). Slow down. Wait a minute, then try again.',
    );
  });

  it('says a host that answers 5xx without the tracker may be restarting', () => {
    const error = new ApiError(502, 'http_error', 'Bad Gateway');
    expect(describeError(error, { trackerUrl: URL })).toBe(
      `The tracker at ${URL} answered HTTP 502 Bad Gateway. It may be restarting: try again in a minute.`,
    );
  });

  it('explains a network failure with the URL it tried', () => {
    const failure = new TypeError('fetch failed', {
      cause: new Error('getaddrinfo ENOTFOUND tracker.up.railway.app'),
    });
    expect(describeError(failure, { trackerUrl: URL })).toBe(
      `Could not reach the tracker at ${URL} (getaddrinfo ENOTFOUND tracker.up.railway.app). Is it running? Check TRACKER_URL (or --url).`,
    );
  });

  it('says an answer that is not JSON came from somewhere else', () => {
    expect(describeError(new SyntaxError("Unexpected token '<'"), { trackerUrl: URL })).toBe(
      `The tracker at ${URL} sent an answer that isn't the tracker's. Check that TRACKER_URL (or --url) is the tracker's address.`,
    );
  });
});
