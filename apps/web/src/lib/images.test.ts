import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fitWithin,
  JPEG_QUALITY,
  jpegName,
  MAX_IMAGE_EDGE,
  MAX_UNTOUCHED_BYTES,
  prepareImageForUpload,
  uploadName,
} from './images';

const fileOf = (name: string, type: string, size = 1000) =>
  new File([new Uint8Array(size)], name, { type });

function mockDecode(width: number, height: number) {
  const close = vi.fn();
  const decode = vi.fn().mockResolvedValue({ width, height, close });
  vi.stubGlobal('createImageBitmap', decode);
  return { decode, close };
}

function mockCanvas(output: Blob | null) {
  const context = {
    fillRect: vi.fn(),
    drawImage: vi.fn(),
    fillStyle: '',
    imageSmoothingQuality: '',
  };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    context as unknown as CanvasRenderingContext2D,
  );
  const toBlob = vi
    .spyOn(HTMLCanvasElement.prototype, 'toBlob')
    .mockImplementation((callback) => callback(output));
  return { context, toBlob };
}

describe('fitWithin', () => {
  it('keeps sizes that already fit', () => {
    expect(fitWithin(800, 600, 2048)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(2048, 100, 2048)).toEqual({ width: 2048, height: 100 });
  });

  it('scales the long edge down to the limit and keeps the aspect ratio', () => {
    expect(fitWithin(4032, 3024, 2048)).toEqual({ width: 2048, height: 1536 });
    expect(fitWithin(3024, 4032, 2048)).toEqual({ width: 1536, height: 2048 });
    expect(fitWithin(10000, 1, 2048)).toEqual({ width: 2048, height: 1 });
  });
});

describe('file names', () => {
  it('keeps a name and swaps the extension for JPEG output', () => {
    expect(uploadName(fileOf('IMG_1.HEIC', 'image/heic'))).toBe('IMG_1.HEIC');
    expect(uploadName(fileOf('', 'image/png'))).toBe('image.png');
    expect(jpegName('IMG_1.HEIC')).toBe('IMG_1.jpg');
    expect(jpegName('screen shot.final.png')).toBe('screen shot.final.jpg');
    expect(jpegName('noext')).toBe('noext.jpg');
    expect(jpegName('.png')).toBe('image.jpg');
  });
});

describe('prepareImageForUpload', () => {
  beforeEach(() => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('unexpected decode')));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('leaves GIFs alone without decoding them', async () => {
    const { decode } = mockDecode(4000, 4000);
    const gif = fileOf('party.gif', 'image/gif', MAX_UNTOUCHED_BYTES * 2);
    await expect(prepareImageForUpload(gif)).resolves.toEqual({ blob: gif, fileName: 'party.gif' });
    expect(decode).not.toHaveBeenCalled();
  });

  it('leaves a small PNG alone', async () => {
    const { close } = mockDecode(1200, 800);
    const { toBlob } = mockCanvas(new Blob(['x'], { type: 'image/jpeg' }));
    const png = fileOf('shot.png', 'image/png', 300_000);
    await expect(prepareImageForUpload(png)).resolves.toEqual({ blob: png, fileName: 'shot.png' });
    expect(toBlob).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalled();
  });

  it('downscales a large photo to a JPEG on the long edge', async () => {
    const { close } = mockDecode(4032, 3024);
    const jpeg = new Blob(['small'], { type: 'image/jpeg' });
    const { context, toBlob } = mockCanvas(jpeg);
    const photo = fileOf('IMG_2001.jpeg', 'image/jpeg', 3_000_000);

    const prepared = await prepareImageForUpload(photo);

    expect(prepared).toEqual({ blob: jpeg, fileName: 'IMG_2001.jpg' });
    expect(context.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, MAX_IMAGE_EDGE, 1536);
    expect(toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', JPEG_QUALITY);
    expect(close).toHaveBeenCalled();
  });

  it('re-encodes a heavy image that fits, but only if that makes it smaller', async () => {
    mockDecode(1800, 1200);
    mockCanvas(new Blob([new Uint8Array(10)], { type: 'image/jpeg' }));
    const heavy = fileOf('scan.png', 'image/png', MAX_UNTOUCHED_BYTES + 1);
    expect((await prepareImageForUpload(heavy)).fileName).toBe('scan.jpg');

    vi.restoreAllMocks();
    mockDecode(1800, 1200);
    mockCanvas(new Blob([new Uint8Array(MAX_UNTOUCHED_BYTES + 5)], { type: 'image/jpeg' }));
    await expect(prepareImageForUpload(heavy)).resolves.toEqual({
      blob: heavy,
      fileName: 'scan.png',
    });
  });

  it('uploads the original when the browser cannot decode it', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new DOMException('', 'Invalid')));
    const heic = fileOf('IMG_3.HEIC', 'image/heic', 5_000_000);
    await expect(prepareImageForUpload(heic)).resolves.toEqual({
      blob: heic,
      fileName: 'IMG_3.HEIC',
    });
  });

  it('converts a HEIC photo the browser can decode, even a small one', async () => {
    mockDecode(1000, 750);
    const jpeg = new Blob(['jpeg'], { type: 'image/jpeg' });
    mockCanvas(jpeg);
    const heic = fileOf('IMG_4.heic', 'image/heic', 400_000);
    await expect(prepareImageForUpload(heic)).resolves.toEqual({
      blob: jpeg,
      fileName: 'IMG_4.jpg',
    });
  });

  it('uploads the original when the canvas cannot produce a JPEG', async () => {
    mockDecode(5000, 5000);
    mockCanvas(null);
    const big = fileOf('big.png', 'image/png', 9_000_000);
    await expect(prepareImageForUpload(big)).resolves.toEqual({ blob: big, fileName: 'big.png' });
  });
});
