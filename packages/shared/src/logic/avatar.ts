export const AVATAR_COLORS = [
  '#5B5BD6',
  '#B4540A',
  '#18794E',
  '#C2298A',
  '#0B68CB',
  '#6E56CF',
] as const;

export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => [...word][0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function avatarColor(name: string): string {
  const trimmed = name.trim();
  let sum = 0;
  for (let index = 0; index < trimmed.length; index++) sum += trimmed.charCodeAt(index);
  return AVATAR_COLORS[sum % AVATAR_COLORS.length] ?? AVATAR_COLORS[0];
}
