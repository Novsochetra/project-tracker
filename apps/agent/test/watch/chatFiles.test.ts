import { CHAT_FILES_MAX } from '@tracker/shared';
import { describe, expect, it } from 'vitest';
import { mergeChatFiles } from '../../src/watch/changes/chatFiles';

describe('mergeChatFiles', () => {
  it("adds a turn's new files after the chat's, each as it was at the turn's start", () => {
    const previous = [{ path: 'a.ts', dirtyBefore: true }];
    expect(mergeChatFiles(previous, ['b.ts', 'a.ts', 'c.ts'], new Set(['a.ts', 'c.ts']))).toEqual({
      files: [
        { path: 'a.ts', dirtyBefore: true },
        { path: 'b.ts', dirtyBefore: false },
        { path: 'c.ts', dirtyBefore: true },
      ],
      cut: false,
    });
  });

  it('keeps at most CHAT_FILES_MAX files and says so', () => {
    const paths = Array.from({ length: CHAT_FILES_MAX + 1 }, (_, i) => `f${i}.ts`);
    const merged = mergeChatFiles([], paths, new Set());
    expect(merged.files).toHaveLength(CHAT_FILES_MAX);
    expect(merged.cut).toBe(true);
  });
});
