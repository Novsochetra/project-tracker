import { afterEach, expect, it, vi } from 'vitest';
import { prepareUpload } from '../../src/lib/uploads';

const KB = 1024;

const bytesOf = (size: number) => new Uint8Array(size);

function decodesAs(width: number, height: number) {
  vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width, height, close: vi.fn() }));
}

function canvasGives(size: number) {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    fillRect: vi.fn(),
    drawImage: vi.fn(),
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((done) =>
    done(new Blob([bytesOf(size)], { type: 'image/jpeg' })),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// PT-145: a photo just past the 4.9 MP budget was always re-encoded at quality 0.92, so a light
// 2592×1944 JPEG of 239 KB went up as 498 KB (Chromium) or 725 KB (WebKit), and the server then
// compressed it a second time.
it('sends a light photo just past the budget as it is when its JPEG would be bigger', async () => {
  decodesAs(2592, 1944);
  canvasGives(498 * KB);
  const photo = new File([bytesOf(239 * KB)], 'DSC_0007.JPG', { type: 'image/jpeg' });
  await expect(prepareUpload(photo)).resolves.toEqual({ blob: photo, fileName: 'DSC_0007.JPG' });
});
