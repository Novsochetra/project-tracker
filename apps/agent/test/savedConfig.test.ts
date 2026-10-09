import { describe, expect, it } from 'vitest';
import {
  ConfigFileError,
  NO_SAVED_CONFIG,
  parseSavedConfig,
  savedToken,
  trackerKey,
  withoutToken,
  withToken,
} from '../src/savedConfig';

const PATH = '/home/dara/.config/project-tracker/config.json';
const RAILWAY = 'https://tracker.up.railway.app';

describe('trackerKey', () => {
  it('names a tracker the same way however its URL is written', () => {
    expect(trackerKey('https://Tracker.up.railway.app/')).toBe(RAILWAY);
    expect(trackerKey(' https://tracker.up.railway.app ')).toBe(RAILWAY);
    expect(trackerKey('http://localhost:4100')).toBe('http://localhost:4100');
    expect(trackerKey('https://example.com/tracker//')).toBe('https://example.com/tracker');
    expect(trackerKey('not a url/')).toBe('not a url');
  });
});

describe('saved tokens', () => {
  it('keeps a token per tracker and makes the last one logged in to the default', () => {
    const local = withToken(NO_SAVED_CONFIG, 'http://localhost:4100', 'trk_local');
    const both = withToken(local, `${RAILWAY}/`, 'trk_online');
    expect(both).toEqual({
      url: RAILWAY,
      tokens: { 'http://localhost:4100': 'trk_local', [RAILWAY]: 'trk_online' },
    });
    expect(savedToken(both, 'https://TRACKER.up.railway.app')).toBe('trk_online');
    expect(savedToken(both, 'https://other.example.com')).toBeUndefined();
  });

  it('forgets one tracker’s token, and the default when it was that tracker', () => {
    const both = withToken(withToken(NO_SAVED_CONFIG, 'http://localhost:4100', 'a'), RAILWAY, 'b');
    expect(withoutToken(both, RAILWAY)).toEqual({ tokens: { 'http://localhost:4100': 'a' } });
    expect(withoutToken(both, 'http://localhost:4100')).toEqual({
      url: RAILWAY,
      tokens: { [RAILWAY]: 'b' },
    });
  });
});

describe('parseSavedConfig', () => {
  it('reads the file, with or without a default tracker', () => {
    const text = JSON.stringify({ url: RAILWAY, tokens: { [RAILWAY]: 'trk_x' } });
    expect(parseSavedConfig(text, PATH)).toEqual({ url: RAILWAY, tokens: { [RAILWAY]: 'trk_x' } });
    expect(parseSavedConfig('{}', PATH)).toEqual({ tokens: {} });
  });

  it('says which file is broken and what to do, without repeating its contents', () => {
    const notJson = () => parseSavedConfig('{"tokens": {"x": "trk_secret"', PATH);
    expect(notJson).toThrow(ConfigFileError);
    expect(notJson).toThrow(`${PATH} is not valid JSON. Fix it, or delete it and log in again.`);
    const wrongShape = () => parseSavedConfig('{"tokens": ["trk_secret"]}', PATH);
    expect(wrongShape).toThrow(/should look like \{"url": "\.\.\.", "tokens"/);
    expect(wrongShape).not.toThrow(/trk_secret/);
  });
});
