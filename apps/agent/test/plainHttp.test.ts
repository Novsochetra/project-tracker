import { describe, expect, it } from 'vitest';
import { plainHttpProblem } from '../src/plainHttp';

describe('plainHttpProblem', () => {
  it.each([
    'https://tracker.up.railway.app',
    'https://192.168.1.20:4100',
    'http://localhost:4100',
    'http://LOCALHOST:4100/',
    'http://127.0.0.1:4100',
    'http://127.1.2.3:4100',
    'http://[::1]:4100',
    'not a url',
  ])('lets a token go to %s', (url) => {
    expect(plainHttpProblem(url)).toBeUndefined();
  });

  it.each([
    'http://tracker.up.railway.app',
    'HTTP://Tracker.example.com/',
    'http://192.168.1.20:4100',
    'http://localhost.example.com:4100',
    'http://127.0.0.1.example.com',
    'http://tracker.localhost:4100',
  ])('keeps a token from %s, which is plain http to another computer', (url) => {
    expect(plainHttpProblem(url)).toBe(
      `Not sending an API token to ${url}: on plain http anyone on the network can read it. ` +
        "Use the tracker's https:// address. Only a tracker on this computer (localhost) gets a token over http.",
    );
  });
});
