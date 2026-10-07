export function changedFields<T extends object>(current: T, edits: Partial<T>): Partial<T> {
  return Object.fromEntries(
    Object.entries(edits).filter(
      ([field, value]) => value !== undefined && current[field as keyof T] !== value,
    ),
  ) as Partial<T>;
}

export const isEmpty = (value: object): boolean => Object.keys(value).length === 0;
