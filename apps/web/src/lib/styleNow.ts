// WebKit leaves an element added while a stylesheet loads unstyled and undrawn until the sheet is
// in, and a part's stylesheet loads with its code, so on an iPhone with a slow network what shows
// on its own meanwhile stayed unseen: the tile's spinner (PT-114), a toast, a screen's loading
// state (PT-116), the offline banner (PT-129). Asking for a box styles it at once, as WebKit
// ignores a loading sheet for that.
// A ref, so it runs as the element is put in, before the frame is drawn.
export function styleNow(element: Element | null): void {
  element?.getBoundingClientRect();
}
