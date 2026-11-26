// Sheets, action sheets and the image viewer are modal; dropdowns are listboxes. Popover menus
// leave focus on their trigger, so only their invisible "Close menu" layer shows they are open;
// that layer also takes the next click and wheel.
const OPEN_OVERLAY = [
  '[aria-modal="true"]',
  '[role="listbox"]',
  '[role="menu"]',
  'button[aria-label="Close menu"]',
].join(', ');

// A closing dropdown, calendar or ••• menu stays a moment, inert, to take the second click of a
// double-click; it is already closed.
export const hasOpenOverlay = (root: ParentNode): boolean =>
  [...root.querySelectorAll(OPEN_OVERLAY)].some((overlay) => !overlay.closest('[inert]'));
