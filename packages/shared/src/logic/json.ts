export type Json = Readonly<Record<string, unknown>>;

export const isJson = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
