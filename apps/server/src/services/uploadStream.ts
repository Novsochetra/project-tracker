// As much of an image as image-size reads from a file to find its dimensions.
export const IMAGE_HEAD_BYTES = 512 * 1024;

export interface UploadLimits {
  maxBytes: number;
  // The Content-Length the client sent, if any: a body that ends short of it was cut off.
  expectedBytes: number | null;
  headBytes: number;
  tooLarge: () => Error;
  incomplete: () => Error;
}

export interface MeasuredUpload {
  body: ReadableStream<Uint8Array>;
  size: () => number;
  head: () => Uint8Array;
}

// Passes an upload on a chunk at a time, so memory holds a chunk rather than the file, and fails
// it as soon as it passes the limit or when it ends short of its length. The first bytes are kept
// for reading an image's dimensions.
export function measureUpload(
  source: ReadableStream<Uint8Array>,
  limits: UploadLimits,
): MeasuredUpload {
  const reader = source.getReader();
  const head = new Uint8Array(limits.headBytes);
  let size = 0;
  const read = () =>
    reader.read().catch(() => {
      throw limits.incomplete();
    });
  const body = new ReadableStream<Uint8Array>(
    {
      async pull(controller) {
        const { done, value } = await read();
        if (done) {
          if (limits.expectedBytes !== null && size !== limits.expectedBytes) {
            throw limits.incomplete();
          }
          controller.close();
          return;
        }
        if (size + value.byteLength > limits.maxBytes) throw limits.tooLarge();
        if (size < head.byteLength) head.set(value.subarray(0, head.byteLength - size), size);
        size += value.byteLength;
        controller.enqueue(value);
      },
      cancel: (reason) => reader.cancel(reason),
    },
    { highWaterMark: 0 },
  );
  return { body, size: () => size, head: () => head.subarray(0, Math.min(size, head.byteLength)) };
}
