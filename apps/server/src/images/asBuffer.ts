// A view, not a copy: an upload kept as it came can be hundreds of megabytes.
export const asBuffer = (bytes: Uint8Array) =>
  Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
