const CAPTURE_PARAM = 'capture';

const NON_TEXT_INPUTS = new Set([
  'button',
  'checkbox',
  'color',
  'file',
  'image',
  'radio',
  'range',
  'reset',
  'submit',
]);

export function isTypingTarget(element: Element | null): boolean {
  if (!(element instanceof HTMLElement)) return false;
  if (element.isContentEditable) return true;
  if (element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) return true;
  return element instanceof HTMLInputElement && !NON_TEXT_INPUTS.has(element.type);
}

export type ShortcutKey = Pick<
  KeyboardEvent,
  'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'repeat' | 'isComposing' | 'defaultPrevented'
>;

export function isCaptureShortcut(event: ShortcutKey, focused: Element | null): boolean {
  if (event.defaultPrevented || event.repeat || event.isComposing) return false;
  if (event.ctrlKey || event.metaKey || event.altKey) return false;
  return event.key.toLowerCase() === 'c' && !isTypingTarget(focused);
}

// Sheets, action sheets and the image viewer are modal; dropdowns are listboxes. Popover menus
// leave focus on their trigger, so only their invisible "Close menu" layer shows they are open,
// and that layer would also take the next click, even one meant for the capture sheet.
const OPEN_OVERLAY = [
  '[aria-modal="true"]',
  '[role="listbox"]',
  '[role="menu"]',
  'button[aria-label="Close menu"]',
].join(', ');

export const hasOpenOverlay = (root: ParentNode): boolean =>
  root.querySelector(OPEN_OVERLAY) !== null;

export const asksForCapture = (search: string): boolean =>
  new URLSearchParams(search).has(CAPTURE_PARAM);

export function withoutCaptureParam(search: string): string {
  const params = new URLSearchParams(search);
  params.delete(CAPTURE_PARAM);
  const rest = params.toString();
  return rest ? `?${rest}` : '';
}
