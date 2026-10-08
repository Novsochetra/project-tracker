import { ApiError } from '@tracker/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { prepareUpload } from './uploads';

const MB = 1024 * 1024;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('prepareUpload', () => {
  it('sends videos, text files and PDFs as they are, without decoding them', async () => {
    const decode = vi.fn();
    vi.stubGlobal('createImageBitmap', decode);
    for (const file of [
      new File(['mov'], 'clip.mov', { type: 'video/quicktime' }),
      new File(['log'], 'server.log', { type: '' }),
      new File(['%PDF'], 'spec.pdf', { type: 'application/pdf' }),
    ]) {
      await expect(prepareUpload(file)).resolves.toEqual({ blob: file, fileName: file.name });
    }
    expect(decode).not.toHaveBeenCalled();
  });

  it('names a nameless file after its type, since a form sends a file with a name', async () => {
    const file = new File(['{}'], '', { type: 'application/json' });
    await expect(prepareUpload(file)).resolves.toEqual({ blob: file, fileName: 'attachment.json' });
  });

  it('prepares images as before', async () => {
    const gif = new File(['gif'], 'cat.gif', { type: 'image/gif' });
    await expect(prepareUpload(gif)).resolves.toEqual({ blob: gif, fileName: 'cat.gif' });
  });

  it('refuses an image still over the limit once prepared, as the server would', async () => {
    const big = new File([new Uint8Array(15 * MB + 1)], 'big.gif', { type: 'image/gif' });
    const prepared = prepareUpload(big);
    await expect(prepared).rejects.toBeInstanceOf(ApiError);
    await expect(prepared).rejects.toThrow('Images can be up to 15 MB.');
  });
});
