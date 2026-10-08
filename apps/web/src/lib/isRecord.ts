// For data read back from storage, a stream or JSON, which may have any shape.
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;
