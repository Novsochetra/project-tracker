import { createHash } from 'node:crypto';

// Stable across restarts so runs queued meanwhile still find this helper; the token keeps it
// unguessable, so nobody can claim the id first.
export function runnerIdFor(parts: readonly string[]): string {
  const hex = createHash('sha256').update(parts.join('\n')).digest('hex');
  const variant = '89ab'[Number.parseInt(hex[16]!, 16) % 4]!;
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `4${hex.slice(13, 16)}`,
    `${variant}${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join('-');
}
