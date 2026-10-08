export const sameProjectKey = (a: string, b: string): boolean =>
  a.toUpperCase() === b.toUpperCase();

export function findProject<T extends { key: string }>(
  projects: readonly T[] | undefined,
  key: string,
): T | undefined {
  return projects?.find((project) => sameProjectKey(project.key, key));
}
