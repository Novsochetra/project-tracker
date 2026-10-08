// Enough to read on a phone, and quick to lay out; longer files open whole in a new tab.
export const TEXT_PREVIEW_MAX_CHARS = 100_000;
// How far back from the limit a line end is looked for, so the preview ends on a whole line.
const LINE_SEARCH = 2_000;

export interface TextPreview {
  text: string;
  cut: boolean;
}

const HIGH_SURROGATE = /[\uD800-\uDBFF]$/;

export function textPreview(text: string, max = TEXT_PREVIEW_MAX_CHARS): TextPreview {
  if (text.length <= max) return { text, cut: false };
  const head = text.slice(0, max).replace(HIGH_SURROGATE, '');
  const lineEnd = head.lastIndexOf('\n');
  return { text: lineEnd >= max - LINE_SEARCH ? head.slice(0, lineEnd) : head, cut: true };
}
