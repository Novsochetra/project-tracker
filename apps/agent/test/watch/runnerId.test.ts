import { runnerId } from '@tracker/shared';
import { describe, expect, it } from 'vitest';
import { runnerIdFor } from '../../src/watch/runnerId';

describe('runnerIdFor', () => {
  it('is a UUID the tracker accepts, the same for the same helper', () => {
    const parts = ['https://tracker.example.com', 'dara-mac', '/code/mobile', 'MOB', 'trk_x'];
    const id = runnerIdFor(parts);
    expect(runnerId.safeParse(id).success).toBe(true);
    expect(runnerIdFor([...parts])).toBe(id);
  });

  it('differs when any part differs, the token included', () => {
    const base = ['url', 'host', '/code', 'MOB', 'trk_a'];
    const ids = new Set([
      runnerIdFor(base),
      runnerIdFor(['url', 'host', '/code', 'WEB', 'trk_a']),
      runnerIdFor(['url', 'host', '/code', 'MOB', 'trk_b']),
    ]);
    expect(ids.size).toBe(3);
  });
});
