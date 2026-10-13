// A name comes from whoever uploaded the file, so it must not reach outside the run's folder: no
// path separators, no leading dots (no `..`, no hidden files), no control characters.
const UNSAFE = /[/\\\p{Cc}]/gu;
const LEADING_DOTS = /^\.+/;
const EXTENSION = /\.[\p{L}\p{N}]{1,10}$/u;
// Most file systems take 255 bytes a name; the tracker keeps up to 200 characters, which in
// another script can be three times that.
const MAX_NAME_BYTES = 200;

function localName(name: string, index: number): string {
  const plain = name.replace(UNSAFE, '_').trim().replace(LEADING_DOTS, '');
  const fallback = `file-${index + 1}${EXTENSION.exec(plain)?.[0] ?? ''}`;
  if (plain === '' || Buffer.byteLength(plain) > MAX_NAME_BYTES) return fallback;
  return plain;
}

// Two files of one question can share a name, so a later one gets its place in front.
export function localNames(names: readonly string[]): string[] {
  const used = new Set<string>();
  return names.map((name, index) => {
    const local = localName(name, index);
    const unique = used.has(local.toLowerCase()) ? `${index + 1}-${local}` : local;
    used.add(unique.toLowerCase());
    return unique;
  });
}
