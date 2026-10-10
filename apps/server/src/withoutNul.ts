// Postgres refuses a NUL in text and SQLite keeps it (db/stripNul.ts), so the tracker drops it.
export const withoutNul = <T>(value: T): T =>
  (typeof value === 'string' && value.includes('\0') ? value.replaceAll('\0', '') : value) as T;

export function withoutNulInJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutNulInJson);
  if (value === null || typeof value !== 'object') return withoutNul(value);
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, withoutNulInJson(item)]),
  );
}
