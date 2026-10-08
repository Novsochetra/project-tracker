const SQLITE_UNIQUE = 'SQLITE_CONSTRAINT_UNIQUE';
const POSTGRES_UNIQUE_VIOLATION = '23505';

export function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('code' in error)) return false;
  return error.code === SQLITE_UNIQUE || error.code === POSTGRES_UNIQUE_VIOLATION;
}
