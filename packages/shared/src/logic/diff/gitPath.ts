const ESCAPES: Record<string, number> = {
  n: 10,
  t: 9,
  '"': 34,
  '\\': 92,
  a: 7,
  b: 8,
  f: 12,
  r: 13,
  v: 11,
};

// Git quotes a path with special characters C-style, non-ASCII as octal UTF-8 bytes.
function unquote(quoted: string): string {
  const bytes: number[] = [];
  const body = quoted.slice(1, -1);
  for (let index = 0; index < body.length; index += 1) {
    const char = body[index] ?? '';
    if (char !== '\\') {
      bytes.push(...new TextEncoder().encode(char));
      continue;
    }
    const octal = /^[0-7]{3}/.exec(body.slice(index + 1, index + 4));
    if (octal) {
      bytes.push(parseInt(octal[0], 8));
      index += 3;
      continue;
    }
    index += 1;
    bytes.push(ESCAPES[body[index] ?? ''] ?? body.charCodeAt(index));
  }
  return new TextDecoder().decode(new Uint8Array(bytes));
}

const isQuoted = (text: string) => text.length >= 2 && text.startsWith('"') && text.endsWith('"');

const plain = (text: string): string => (isQuoted(text) ? unquote(text) : text);

// `a/src/x.ts` is src/x.ts; /dev/null is no file.
export function sidePath(text: string): string | null {
  const path = plain(text.replace(/\t.*$/, ''));
  if (path === '/dev/null') return null;
  return /^[ab]\//.test(path) ? path.slice(2) : path;
}

// `diff --git a/P b/P` names one path twice when the file kept its name; a rename has its own
// lines, so only that case matters.
export function headerPath(rest: string): string {
  if (rest.startsWith('"')) {
    const end = rest.indexOf('" ', 1);
    return sidePath(end === -1 ? rest : rest.slice(0, end + 1)) ?? '';
  }
  const half = (rest.length - 5) / 2;
  if (Number.isInteger(half) && rest.slice(2, 2 + half) === rest.slice(5 + half)) {
    return rest.slice(2, 2 + half);
  }
  return sidePath(rest.split(' ')[0] ?? '') ?? '';
}
