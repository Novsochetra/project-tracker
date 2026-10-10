import { afterEach, expect, it, vi } from 'vitest';
import { prepareUpload } from '../../src/lib/uploads';

const KB = 1024;

const heicBytes = (size: number) => {
  const bytes = new Uint8Array(size);
  bytes.set([0, 0, 0, 0x20, ...new TextEncoder().encode('ftypheic')]);
  return bytes;
};

function decodesAs(width: number, height: number) {
  vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width, height, close: vi.fn() }));
}

function canvasGives(size: number) {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    fillRect: vi.fn(),
    drawImage: vi.fn(),
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((done) =>
    done(new Blob([new Uint8Array(size)], { type: 'image/jpeg' })),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// Reviewer 135 (PT-145): Safari decodes a HEIC whatever its name says, and a HEIC named .JPG comes
// with type image/jpeg. Past the 4.9 MP budget it was always converted, so its GPS never left the
// phone; since PT-145 the original goes when its JPEG would be bigger (HEIC is about twice as
// efficient as JPEG, so it usually is), and the server stores it as image/heic with its GPS. Same
// for an AVIF named .jpg in Chrome or Safari (sniffed as image/heif).
it('converts a HEIC named .JPG past the budget, even when its JPEG would be bigger', async () => {
  decodesAs(3840, 2160);
  canvasGives(1150 * KB);
  const photo = new File([heicBytes(741 * KB)], 'IMG_0042.JPG', { type: 'image/jpeg' });
  const prepared = await prepareUpload(photo);
  expect(prepared.blob).not.toBe(photo);
  expect(prepared).toMatchObject({ fileName: 'IMG_0042.jpg', blob: { type: 'image/jpeg' } });
});
