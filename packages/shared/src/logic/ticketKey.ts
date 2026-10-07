export const formatTicketKey = (projectKey: string, num: number): string => `${projectKey}-${num}`;

export interface ParsedTicketKey {
  projectKey: string;
  num: number;
}

export function parseTicketKey(key: string): ParsedTicketKey | null {
  const match = /^([A-Za-z0-9]+)-(\d+)$/.exec(key.trim());
  if (!match?.[1] || !match[2]) return null;
  const num = Number.parseInt(match[2], 10);
  if (num < 1) return null;
  return { projectKey: match[1].toUpperCase(), num };
}
