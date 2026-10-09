export interface UploadLimits {
  maxBytes: number;
  // The Content-Length the client sent, if any: a body that ends short of it was cut off.
  expectedBytes: number | null;
  tooLarge: () => Error;
  incomplete: () => Error;
}

export interface MeasuredUpload {
  body: ReadableStream<Uint8Array>;
  size: () => number;
}

// Passes an upload on a chunk at a time, so memory holds a chunk rather than the file, and fails
// it as soon as it passes the limit or when it ends short of its length.
export function measureUpload(
  source: ReadableStream<Uint8Array>,
  limits: UploadLimits,
): MeasuredUpload {
  const reader = source.getReader();
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
        size += value.byteLength;
        controller.enqueue(value);
      },
      cancel: (reason) => reader.cancel(reason),
    },
    { highWaterMark: 0 },
  );
  return { body, size: () => size };
}

// For images, which sharp reads whole. measureUpload stops them at their 15 MB limit.
export async function readWhole(body: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of body) chunks.push(chunk);
  return Buffer.concat(chunks);
}
