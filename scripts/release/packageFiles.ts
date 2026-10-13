type Json = Record<string, unknown>;

// npm writes both files as two-space JSON with a final newline, and puts version after name.
const write = (json: Json): string => `${JSON.stringify(json, null, 2)}\n`;

function withVersionAfterName(json: Json, version: string): Json {
  const { name, version: _old, ...rest } = json;
  return name === undefined ? { version, ...rest } : { name, version, ...rest };
}

export const readVersion = (packageText: string): string => {
  const { version } = JSON.parse(packageText) as Json;
  if (typeof version !== 'string') throw new Error('package.json has no version.');
  return version;
};

export const setPackageVersion = (packageText: string, version: string): string =>
  write(withVersionAfterName(JSON.parse(packageText) as Json, version));

export function setLockVersion(lockText: string, version: string): string {
  const lock = JSON.parse(lockText) as Json & { packages?: Record<string, Json> };
  const root = lock.packages?.[''];
  const packages = root ? { ...lock.packages, '': withVersionAfterName(root, version) } : undefined;
  const updated = withVersionAfterName(lock, version);
  return write(packages ? { ...updated, packages } : updated);
}
