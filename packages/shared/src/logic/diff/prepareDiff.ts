import { RUN_DIFF_MAX } from '../../domain/changes';
import { capDiff, type CappedDiff } from './capDiff';
import { maskDiff } from './maskDiff';

// `readCut`: the text is the start of a longer one, so its last line may be part of a line, and
// part of a secret no rule knows; that line goes. Masking reads every line, so it gets a bounded
// text: twice the cap, from its last whole line.
export function prepareDiff(raw: string, readCut = false, max = RUN_DIFF_MAX): CappedDiff {
  const whole = readCut ? raw.slice(0, raw.lastIndexOf('\n') + 1) : raw;
  const bounded = capDiff(whole, max * 2);
  const capped = capDiff(maskDiff(bounded.diff), max);
  return { diff: capped.diff, cut: readCut || bounded.cut || capped.cut };
}
