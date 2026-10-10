import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JPEG_QUALITY, MAX_UNTOUCHED_PHOTO_BYTES } from './imagePlan';
import { prepareImageForUpload, renamedAs, uploadName } from './images';

const MB = 1024 * 1024;

const fileOf = (name: string, type: string, size = 1000) =>
  new File([new Uint8Array(size)], name, { type });

const blobOf = (type: string, size = 10) => new Blob([new Uint8Array(size)], { type });

function mockDecode(width: number, height: number) {
  const close = vi.fn();
  const decode = vi.fn().mockResolvedValue({ width, height, close });
  vi.stubGlobal('createImageBitmap', decode);
  return { decode, close };
}

// Each toBlob call gives the next output, or the last one again.
function mockCanvas(...outputs: (Blob | null)[]) {
  const context = {
    fillRect: vi.fn(),
    drawImage: vi.fn(),
    fillStyle: '',
    imageSmoothingQuality: '',
  };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    context as unknown as CanvasRenderingContext2D,
  );
  let call = 0;
  const toBlob = vi
    .spyOn(HTMLCanvasElement.prototype, 'toBlob')
    .mockImplementation((callback) => callback(outputs[Math.min(call++, outputs.length - 1)]!));
  return { context, toBlob };
}

describe('file names', () => {
  it('keeps a name, or names a nameless file after its type', () => {
    expect(uploadName(fileOf('IMG_1.HEIC', 'image/heic'), 'image/heic')).toBe('IMG_1.HEIC');
    expect(uploadName(fileOf('', 'image/png'), 'image/png')).toBe('image.png');
    expect(uploadName(fileOf('', 'image/jpeg'), 'image/jpeg')).toBe('image.jpg');
  });

  it('swaps the extension for the type it was encoded as', () => {
    expect(renamedAs('IMG_1.HEIC', 'image/jpeg')).toBe('IMG_1.jpg');
    expect(renamedAs('screen shot.final.png', 'image/jpeg')).toBe('screen shot.final.jpg');
    expect(renamedAs('Screenshot.PNG', 'image/png')).toBe('Screenshot.png');
    expect(renamedAs('noext', 'image/jpeg')).toBe('noext.jpg');
    expect(renamedAs('.png', 'image/jpeg')).toBe('image.jpg');
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
    const gif = fileOf('party.gif', 'image/gif', 5 * MB);
    await expect(prepareImageForUpload(gif, 'image/gif')).resolves.toEqual({
      blob: gif,
      fileName: 'party.gif',
    });
    expect(decode).not.toHaveBeenCalled();
  });

  it('sends a light photo within the budget as it is', async () => {
    const { close } = mockDecode(2560, 1920);
    const { toBlob } = mockCanvas(blobOf('image/jpeg'));
    const photo = fileOf('IMG_5.JPG', 'image/jpeg', MAX_UNTOUCHED_PHOTO_BYTES);
    await expect(prepareImageForUpload(photo, 'image/jpeg')).resolves.toEqual({
      blob: photo,
      fileName: 'IMG_5.JPG',
    });
    expect(toBlob).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalled();
  });

  it('shrinks a large photo to a JPEG within the budget, on white', async () => {
    const { close } = mockDecode(4032, 3024);
    const jpeg = blobOf('image/jpeg');
    const { context, toBlob } = mockCanvas(jpeg);
    const photo = fileOf('IMG_2001.jpeg', 'image/jpeg', 3_000_000);

    await expect(prepareImageForUpload(photo, 'image/jpeg')).resolves.toEqual({
      blob: jpeg,
      fileName: 'IMG_2001.jpg',
    });
    expect(context.fillRect).toHaveBeenCalledWith(0, 0, 2560, 1920);
    expect(context.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 2560, 1920);
    expect(toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', JPEG_QUALITY);
    expect(close).toHaveBeenCalled();
  });

  it('re-encodes a heavy photo that fits, but only if that makes it smaller', async () => {
    mockDecode(2400, 1600);
    const smaller = blobOf('image/jpeg', 10);
    mockCanvas(smaller);
    const heavy = fileOf('scan.webp', 'image/webp', MAX_UNTOUCHED_PHOTO_BYTES + 1);
    await expect(prepareImageForUpload(heavy, 'image/webp')).resolves.toEqual({
      blob: smaller,
      fileName: 'scan.jpg',
    });

    vi.restoreAllMocks();
    mockDecode(2400, 1600);
    mockCanvas(blobOf('image/jpeg', MAX_UNTOUCHED_PHOTO_BYTES + 5));
    await expect(prepareImageForUpload(heavy, 'image/webp')).resolves.toEqual({
      blob: heavy,
      fileName: 'scan.webp',
    });
  });

  it('sends a screenshot within 8.3 MP and 15 MB as the PNG it is', async () => {
    mockDecode(2880, 1800);
    const { toBlob } = mockCanvas(blobOf('image/jpeg'));
    const shot = fileOf('Screenshot.png', 'image/png', 9 * MB);
    await expect(prepareImageForUpload(shot, 'image/png')).resolves.toEqual({
      blob: shot,
      fileName: 'Screenshot.png',
    });
    expect(toBlob).not.toHaveBeenCalled();
  });

  it('shrinks a screenshot past 8.3 MP to a PNG, keeping its transparency', async () => {
    mockDecode(5120, 2880);
    const png = blobOf('image/png');
    const { context, toBlob } = mockCanvas(png);
    const shot = fileOf('Screenshot.png', 'image/png', 6 * MB);
    await expect(prepareImageForUpload(shot, 'image/png')).resolves.toEqual({
      blob: png,
      fileName: 'Screenshot.png',
    });
    expect(context.fillRect).not.toHaveBeenCalled();
    expect(context.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 3840, 2160);
    expect(toBlob).toHaveBeenCalledTimes(1);
    expect(toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/png', JPEG_QUALITY);
  });

  it('makes a JPEG of a PNG that is still over 15 MB once shrunk', async () => {
    mockDecode(6000, 4000);
    const jpeg = blobOf('image/jpeg');
    const { context, toBlob } = mockCanvas(blobOf('image/png', 15 * MB + 1), jpeg);
    const photo = fileOf('export.png', 'image/png', 40 * MB);
    await expect(prepareImageForUpload(photo, 'image/png')).resolves.toEqual({
      blob: jpeg,
      fileName: 'export.jpg',
    });
    expect(toBlob).toHaveBeenNthCalledWith(2, expect.any(Function), 'image/jpeg', JPEG_QUALITY);
    expect(context.drawImage).toHaveBeenLastCalledWith(expect.anything(), 0, 0, 2715, 1810);
  });

  it('uploads the original when the browser cannot decode it', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new DOMException('', 'Invalid')));
    const heic = fileOf('IMG_3.HEIC', 'image/heic', 5_000_000);
    await expect(prepareImageForUpload(heic, 'image/heic')).resolves.toEqual({
      blob: heic,
      fileName: 'IMG_3.HEIC',
    });
  });

  it('converts a HEIC photo the browser can decode, even a small one', async () => {
    mockDecode(1000, 750);
    const jpeg = blobOf('image/jpeg');
    mockCanvas(jpeg);
    const heic = fileOf('IMG_4.heic', '', 400_000);
    await expect(prepareImageForUpload(heic, 'image/heic')).resolves.toEqual({
      blob: jpeg,
      fileName: 'IMG_4.jpg',
    });
  });

  it('uploads the original when the canvas cannot produce an image', async () => {
    mockDecode(5000, 5000);
    mockCanvas(null);
    const big = fileOf('big.png', 'image/png', 9_000_000);
    await expect(prepareImageForUpload(big, 'image/png')).resolves.toEqual({
      blob: big,
      fileName: 'big.png',
    });
  });
});
