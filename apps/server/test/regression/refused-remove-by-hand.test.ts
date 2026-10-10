import { describe, expect, it, vi } from 'vitest';
import { removeFiles } from '../../src/storage/fileStorage';
import { createMemoryStorage } from '../../src/storage/memoryStorage';

// Reviewer 116 (PT-133): a file storage refused to remove was logged as staying "until the next
// clean-up", but since the start-up sweep went no clean-up removes it: a person has to
// (docs/s3-storage.md quotes the log's start, "File <key> stays").
describe('a file that storage refuses to remove', () => {
  it('is logged as one a person must remove', async () => {
    const storage = {
      ...createMemoryStorage(),
      remove: () => Promise.reject(new Error('Access Denied')),
    };
    const warned = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await removeFiles(storage, ['f1.txt']);
    const logged = warned.mock.calls.flat().join(' ');
    warned.mockRestore();
    expect(logged).toMatch(/^File f1\.txt stays/);
    expect(logged).toContain('removed by hand');
    expect(logged).toContain('Access Denied');
    expect(logged).not.toContain('clean-up');
  });
});
