const ELLIPSIS = '…';
const HIGH_SURROGATE = /[\uD800-\uDBFF]/;

export const oneLine = (text: string): string => text.replace(/\s+/g, ' ').trim();

// Never ends on half of an emoji, which no font can draw.
export const sliceWhole = (text: string, end: number): string =>
  text.slice(0, HIGH_SURROGATE.test(text.charAt(end - 1)) ? end - 1 : end);

export function cutTo(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${sliceWhole(text, max - ELLIPSIS.length).trimEnd()}${ELLIPSIS}`;
}
