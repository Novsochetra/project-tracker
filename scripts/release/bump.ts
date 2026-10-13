export const RELEASE_PARTS = ['patch', 'minor', 'major'] as const;

export type ReleasePart = (typeof RELEASE_PARTS)[number];

export const isReleasePart = (value: string | undefined): value is ReleasePart =>
  RELEASE_PARTS.includes(value as ReleasePart);

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;

export function bumpVersion(current: string, part: ReleasePart): string {
  const match = SEMVER.exec(current);
  if (!match) throw new Error(`"${current}" is not a version like 1.2.3.`);
  const [major, minor, patch] = match.slice(1).map(Number) as [number, number, number];
  if (part === 'major') return `${major + 1}.0.0`;
  if (part === 'minor') return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}
