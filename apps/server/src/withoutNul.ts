// Postgres refuses a NUL in text and SQLite keeps it (db/stripNul.ts), so the tracker drops it.
export const withoutNul = <T>(value: T): T =>
  (typeof value === 'string' && value.includes('\0') ? value.replaceAll('\0', '') : value) as T;

type Container = Record<string, unknown>;

const isContainer = (value: unknown): value is Container =>
  typeof value === 'object' && value !== null;

// A loop, not recursion: a request body can nest as deep as its size allows, and a field nested
// 200,000 levels deep overflowed the stack. Spread copies keep a __proto__ key an own field, as
// JSON.parse made it, so setting it below never changes a prototype.
export function withoutNulInJson(value: unknown): unknown {
  const root: Container = { value };
  const pending = [root];
  for (let node = pending.pop(); node; node = pending.pop()) {
    for (const key of Object.keys(node)) {
      const item = node[key];
      if (!isContainer(item)) {
        node[key] = withoutNul(item);
        continue;
      }
      const copy = (Array.isArray(item) ? [...item] : { ...item }) as Container;
      node[key] = copy;
      pending.push(copy);
    }
  }
  return root.value;
}
