const ELLIPSIS = '…';
const HIGH_SURROGATE = /[\uD800-\uDBFF]/;

export const oneLine = (text: string): string => text.replace(/\s+/g, ' ').trim();

// Never ends on half of an emoji, which no font can draw.
export function cutTo(text: string, max: number): string {
  if (text.length <= max) return text;
  let end = max - ELLIPSIS.length;
  if (HIGH_SURROGATE.test(text.charAt(end - 1))) end -= 1;
  return `${text.slice(0, end).trimEnd()}${ELLIPSIS}`;
}
