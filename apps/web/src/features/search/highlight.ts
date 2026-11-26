export interface TextPart {
  text: string;
  hit: boolean;
}

function hitMask(text: string, terms: readonly string[]): boolean[] | null {
  const lower = text.toLowerCase();
  // A few letters lowercase to two characters, which would shift every index after them.
  if (lower.length !== text.length) return null;
  const mask = new Array<boolean>(text.length).fill(false);
  for (const term of terms) {
    if (!term) continue;
    for (let at = lower.indexOf(term); at >= 0; at = lower.indexOf(term, at + term.length)) {
      mask.fill(true, at, at + term.length);
    }
  }
  return mask;
}

export function highlightParts(text: string, terms: readonly string[]): TextPart[] {
  const mask = hitMask(text, terms);
  if (!mask) return [{ text, hit: false }];
  const parts: TextPart[] = [];
  let start = 0;
  for (let index = 1; index <= text.length; index += 1) {
    if (index < text.length && mask[index] === mask[start]) continue;
    parts.push({ text: text.slice(start, index), hit: mask[start] ?? false });
    start = index;
  }
  return parts;
}
