// Where each line of text inside `element` ends, from the element's top. A field's text isn't
// laid out in the page, and jsdom lays out nothing: both give none.
export function lineEnds(element: HTMLElement): number[] {
  const range = document.createRange();
  if (element instanceof HTMLTextAreaElement || typeof range.getClientRects !== 'function') {
    return [];
  }
  const top = element.getBoundingClientRect().top;
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const ends: number[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    range.selectNodeContents(node);
    for (const rect of range.getClientRects()) ends.push(rect.bottom - top);
  }
  return ends;
}
