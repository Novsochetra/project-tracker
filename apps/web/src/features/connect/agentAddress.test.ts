import { describe, expect, it } from 'vitest';
import { addressNote, agentAddress } from './agentAddress';

describe('agentAddress', () => {
  it('moves a plain-http address of another computer to localhost on the same port', () => {
    expect(agentAddress('http://192.168.1.20:4100')).toBe('http://localhost:4100');
    expect(agentAddress('http://tracker.lan')).toBe('http://localhost');
    expect(agentAddress('http://tracker.localhost:4100')).toBe('http://localhost:4100');
  });

  it.each([
    'https://tracker.up.railway.app',
    'https://192.168.1.20:4100',
    'http://localhost:4100',
    'http://127.0.0.1:4100',
    'http://[::1]:4100',
    'not a url',
  ])('keeps %s', (address) => {
    expect(agentAddress(address)).toBe(address);
  });
});

describe('addressNote', () => {
  it('says where agents reach the tracker', () => {
    expect(addressNote('http://localhost:4100', 'http://localhost:4100')).toBe(
      'Agents on this computer reach the tracker here.',
    );
    expect(addressNote('https://t.ts.net', 'https://t.ts.net')).toBe(
      'Agents reach the tracker here, from any computer.',
    );
    expect(addressNote('http://192.168.1.20:4100', 'http://localhost:4100')).toBe(
      'Agents on the tracker’s computer reach it here. On other computers they need its https address: plain http would show their token to the network.',
    );
  });
});
