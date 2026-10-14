import { readdirSync } from 'node:fs';
import type { Attachment } from '@tracker/shared';
import { describe, expect, it, vi } from 'vitest';
import { withAskFiles } from '../../src/watch/ask/askFiles';

// PT-233 review: the tracker keeps a HEIC as it came, with where it was taken, so a helper must
// never put one in Claude's folder, even when an older tracker sends it.
const file = (id: string, fileName: string, mimeType: string): Attachment => ({
  id,
  ticketId: null,
  activityId: null,
  fileName,
  mimeType,
  size: 5,
  width: null,
  height: null,
  url: `/api/attachments/${id}/file`,
  createdAt: 1,
});

describe("a question's HEIC or HEIF", () => {
  it("is never downloaded into Claude's folder", async () => {
    const fetchFile = vi.fn((id: string) => Promise.resolve(new Response(`bytes of ${id}`)));
    const files = [
      file('f1', 'IMG_1.heic', 'image/heic'),
      file('f2', 'IMG_2.heif', 'image/heif'),
      file('f3', 'board.jpg', 'image/jpeg'),
    ];
    const seen = await withAskFiles(
      fetchFile,
      { job: { files }, stop: new AbortController().signal },
      (folder) => Promise.resolve(folder ? readdirSync(folder.dir) : []),
    );
    expect(seen).toEqual(['board.jpg']);
    expect(fetchFile.mock.calls.map(([id]) => id)).toEqual(['f3']);
  });
});
