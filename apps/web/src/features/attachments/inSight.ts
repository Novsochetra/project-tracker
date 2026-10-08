// Its middle is on the screen and nothing covers it there, such as a sheet's header or the phone's
// bottom bar. A page without layout (jsdom) can't tell, so there it counts as seen.
export function inSight(element: Element): boolean {
  if (typeof document.elementFromPoint !== 'function') return true;
  const box = element.getBoundingClientRect();
  const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
  return hit !== null && element.contains(hit);
}
