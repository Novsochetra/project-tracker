import type { Actor } from '@tracker/shared';

export const SEP = ' · ';

export { formatBytes } from '@tracker/shared';

const pad = (value: number): string => String(value).padStart(2, '0');

export function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return `${day} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// Agents read this output, so the person is "User" rather than the web app's "You".
export function authorName(actor: Actor): string {
  const name = actor.name.trim();
  if (name) return name;
  return actor.kind === 'agent' ? 'Agent' : 'User';
}
