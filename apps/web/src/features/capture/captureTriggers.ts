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

/** Fields where a typed letter is text: inputs, textareas, selects and editable content. */
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

/** C, with no modifier, while no text field has focus. */
export function isCaptureShortcut(event: ShortcutKey, focused: Element | null): boolean {
  if (event.defaultPrevented || event.repeat || event.isComposing) return false;
  if (event.ctrlKey || event.metaKey || event.altKey) return false;
  return event.key.toLowerCase() === 'c' && !isTypingTarget(focused);
}

export const asksForCapture = (search: string): boolean =>
  new URLSearchParams(search).has(CAPTURE_PARAM);

export function withoutCaptureParam(search: string): string {
  const params = new URLSearchParams(search);
  params.delete(CAPTURE_PARAM);
  const rest = params.toString();
  return rest ? `?${rest}` : '';
}
