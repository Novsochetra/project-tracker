export const FOLD_LINES = 8;
// A fold that hid only a line or two would save less room than its Show more button takes.
const SLACK_LINES = 3;
const NORMAL_LINE_HEIGHT = 1.2;
// The body text's 14px at 1.5, for an element the browser gives no computed style (tests).
const BODY_LINE = 21;

export interface FoldBox {
  // The height of the text alone, without padding.
  text: number;
  lineHeight: number;
  // Padding and borders, which the folded box keeps around its lines.
  frame: number;
  // Where the text's lines end, from its top, when the browser lays them out where they can be
  // read (not in a field).
  lineEnds?: readonly number[];
}

// Text in a box can run on other lines than the box's own (a report's 20px lines in a card of
// 21px), so the fold ends where the last line that fits does, instead of through the next one.
function lastLineEnd(limit: number, lineEnds: readonly number[]): number {
  const within = lineEnds.filter((end) => end <= limit);
  return within.length > 0 ? Math.max(...within) : limit;
}

export function foldedHeight({ text, lineHeight, frame, lineEnds = [] }: FoldBox): number | null {
  if (!(lineHeight > 0)) return null;
  const shown = FOLD_LINES * lineHeight;
  if (text <= shown + SLACK_LINES * lineHeight) return null;
  return Math.round(lastLineEnd(shown, lineEnds) + frame);
}

export function lineHeightOf(lineHeight: string, fontSize: string): number {
  const height = Number.parseFloat(lineHeight);
  if (Number.isFinite(height)) return height;
  const size = Number.parseFloat(fontSize);
  return Number.isFinite(size) ? size * NORMAL_LINE_HEIGHT : BODY_LINE;
}
