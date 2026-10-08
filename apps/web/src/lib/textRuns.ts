// WebKit lays out a text node whose run has no break opportunity, such as 90,000 closing brackets,
// wider than its box, so the screen scrolls sideways; the same text in shorter nodes wraps.
export const MAX_RUN = 10_000;

const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

// Splits only between graphemes: WebKit draws one split across two text nodes as two, such as an
// accent apart from its letter.
export function textRuns(text: string): string[] {
  if (text.length <= MAX_RUN) return [text];
  const segments = graphemes.segment(text);
  const runs: string[] = [];
  let start = 0;
  while (text.length - start > MAX_RUN) {
    const { index, segment } = segments.containing(start + MAX_RUN)!;
    const end = index > start ? index : index + segment.length;
    runs.push(text.slice(start, end));
    start = end;
  }
  if (start < text.length) runs.push(text.slice(start));
  return runs;
}
