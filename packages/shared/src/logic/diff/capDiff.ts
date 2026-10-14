import { RUN_DIFF_MAX } from '../../domain/changes';

export interface CappedDiff {
  diff: string;
  cut: boolean;
}

// Cut at a line's end, so no line, and no secret masked in it, is shown in part.
export function capDiff(text: string, max = RUN_DIFF_MAX): CappedDiff {
  if (text.length <= max) return { diff: text, cut: false };
  const end = text.lastIndexOf('\n', max - 1);
  return { diff: end === -1 ? '' : text.slice(0, end + 1), cut: true };
}
