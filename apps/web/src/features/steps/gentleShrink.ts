// Only a shrink is eased: a new step grows the list by its own row, which fades in, and an eased
// growth would hold the newest row below the end that useFollowEnd scrolled to.
export function shrinkFrames(from: number | null, to: number): Keyframe[] | null {
  if (from === null || to >= from) return null;
  return [{ height: `${from}px` }, { height: `${to}px` }];
}
