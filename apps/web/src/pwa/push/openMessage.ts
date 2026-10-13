export const OPEN_MESSAGE = 'tracker:open';

export interface OpenMessage {
  type: typeof OPEN_MESSAGE;
  path: string;
}

// Only a path in the app itself: never another site, nor "//host", which a browser reads as one.
export const appPathOf = (value: unknown): string | null =>
  typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : null;

export function openPathOf(data: unknown): string | null {
  if (typeof data !== 'object' || data === null) return null;
  const { type, path } = data as Partial<OpenMessage>;
  return type === OPEN_MESSAGE ? appPathOf(path) : null;
}
