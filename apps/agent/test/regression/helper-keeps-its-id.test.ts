import { randomUUID } from 'node:crypto';
import { runnerId } from '@tracker/shared';
import { describe, expect, it } from 'vitest';
import { computerName, runnerIdFor } from '../../src/watch/identity';
import { withToken } from '../../src/savedConfig';
import { memoryStore } from '../memoryStore';

// Reviewer 140: the id hashed the host name (on some Macs the network address) and the token, so a
// new network, address or token made a new helper, and runs queued on the old one waited forever.
// The name was "192.168.1.7" instead of the Mac's name.
describe('regression: a helper keeps one id per tracker and folder', () => {
  it('picks a UUID once, keeps it through a new login, and has one per folder', () => {
    const store = memoryStore();
    const id = runnerIdFor(store, 'https://tracker.example.com/', '/code/mobile');
    expect(runnerId.safeParse(id).success).toBe(true);
    store.write(withToken(store.read(), 'https://tracker.example.com', `trk_${randomUUID()}`));
    expect(runnerIdFor(store, 'https://tracker.example.com', '/code/mobile')).toBe(id);
    expect(runnerIdFor(store, 'https://tracker.example.com', '/code/web')).not.toBe(id);
    expect(runnerIdFor(store, 'http://localhost:4100', '/code/mobile')).not.toBe(id);
  });

  it("names the computer as people know it, within the tracker's limit", () => {
    const name = computerName();
    expect(name).not.toMatch(/^\d+\.\d+\.\d+\.\d+$/);
    expect(name.length).toBeGreaterThan(0);
    expect(name.length).toBeLessThanOrEqual(60);
  });
});
