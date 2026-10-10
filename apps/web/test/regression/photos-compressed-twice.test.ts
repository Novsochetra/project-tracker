import { afterEach, expect, it, vi } from 'vitest';
import { prepareUpload } from '../../src/lib/uploads';

const MB = 1024 * 1024;

const fileOf = (name: string, type: string, size: number) =>
  new File([new Uint8Array(size)], name, { type });

function decodesAs(width: number, height: number) {
  vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width, height, close: vi.fn() }));
}

function canvasGives(type: string) {
  const drawImage = vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    fillRect: vi.fn(),
    drawImage,
  } as unknown as CanvasRenderingContext2D);
  const toBlob = vi
    .spyOn(HTMLCanvasElement.prototype, 'toBlob')
    .mockImplementation((done) => done(new Blob(['encoded'], { type })));
  return { drawImage, toBlob };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// PT-134: the phone shrank every image to a JPEG of 2048 px before the server made its WebP, so a
// photo never reached the server's 2560×1920 budget and was compressed twice, and a screenshot
// arrived as a JPEG with blurred text.
it('shrinks a 12 MP photo to the server’s budget, not to 2048 px', async () => {
  decodesAs(4032, 3024);
  const { drawImage } = canvasGives('image/jpeg');
  await prepareUpload(fileOf('IMG_0042.JPG', 'image/jpeg', 4 * MB));
  expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 2560, 1920);
});

it('sends a 3 MB screenshot as the PNG it is', async () => {
  decodesAs(1290, 2796);
  const { toBlob } = canvasGives('image/jpeg');
  const shot = fileOf('IMG_0043.PNG', 'image/png', 3 * MB);
  await expect(prepareUpload(shot)).resolves.toEqual({ blob: shot, fileName: 'IMG_0043.PNG' });
  expect(toBlob).not.toHaveBeenCalled();
});
