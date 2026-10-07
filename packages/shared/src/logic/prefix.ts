export const FALLBACK_PREFIX = 'PRJ';
const MAX_PREFIX_LENGTH = 5;

export function derivePrefix(name: string): string {
  const words = name
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return FALLBACK_PREFIX;
  if (words.length === 1) return (words[0] ?? '').slice(0, 3);
  return words
    .map((word) => word[0])
    .join('')
    .slice(0, 4);
}

export function resolvePrefix(typed: string, name: string): string {
  const source = typed.trim() || derivePrefix(name);
  const cleaned = source
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, MAX_PREFIX_LENGTH);
  return cleaned || FALLBACK_PREFIX;
}

export function uniquePrefix(prefix: string, taken: ReadonlySet<string>): string {
  let candidate = prefix;
  for (let suffix = 2; taken.has(candidate); suffix++) {
    candidate = prefix.slice(0, 4) + String(suffix);
  }
  return candidate;
}
