const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(',');

export function focusableWithin(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (element) => element.closest('[inert], [hidden]') === null,
  );
}

export function trapTab(event: KeyboardEvent, root: HTMLElement): void {
  if (event.key !== 'Tab' || event.defaultPrevented) return;
  const active = document.activeElement;
  // Dropdowns opened from the sheet live in body portals and manage their own Tab.
  if (active?.closest('[data-dropdown]')) return;
  const items = focusableWithin(root);
  const first = items[0];
  const last = items[items.length - 1];
  if (!first || !last) {
    event.preventDefault();
    root.focus();
    return;
  }
  if (event.shiftKey && (active === first || active === root)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (active === last || active === root)) {
    event.preventDefault();
    first.focus();
  }
}
