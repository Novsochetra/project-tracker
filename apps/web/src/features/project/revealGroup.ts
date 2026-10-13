import { visibleTop } from '../../navigation/visibleTop';

const GAP_ABOVE_GROUP = 16;

// A group collapsed from far down its list shrinks above the view, which then shows whatever came
// after it; this brings its header back to just under the top.
export const scrollBackBy = (groupTop: number, viewTop: number): number =>
  groupTop >= viewTop ? 0 : groupTop - viewTop - GAP_ABOVE_GROUP;

export function revealGroupTop(group: HTMLElement, scroller: HTMLElement): void {
  const distance = scrollBackBy(group.getBoundingClientRect().top, visibleTop(scroller));
  if (distance < 0) scroller.scrollTop += distance;
}
