const ELLIPSIS = '…';
const HIGH_SURROGATE = /[\uD800-\uDBFF]/;

export const oneLine = (text: string): string => text.replace(/\s+/g, ' ').trim();

// Never ends on half of an emoji, which no font can draw. A cut kept whole (`trim: false`) is
// max or max - 1 long, so it can be told from a text that merely ends in an ellipsis.
export function cutTo(text: string, max: number, { trim = true } = {}): string {
  if (text.length <= max) return text;
  let end = max - ELLIPSIS.length;
  if (HIGH_SURROGATE.test(text.charAt(end - 1))) end -= 1;
  const kept = text.slice(0, end);
  return `${trim ? kept.trimEnd() : kept}${ELLIPSIS}`;
}

export const isCutAt = (text: string, max: number): boolean =>
  text.length >= max - ELLIPSIS.length && text.endsWith(ELLIPSIS);
