const NON_TEXT_INPUT_TYPES = new Set([
  'button',
  'checkbox',
  'color',
  'file',
  'hidden',
  'image',
  'radio',
  'range',
  'reset',
  'submit',
]);

const OPEN_DIALOG = '[role="dialog"], [role="alertdialog"], dialog[open]';

const isTextField = (element: Element | null): boolean =>
  element instanceof HTMLTextAreaElement ||
  (element instanceof HTMLInputElement && !NON_TEXT_INPUT_TYPES.has(element.type));

export function isSafeToReload(doc: Document): boolean {
  if (doc.visibilityState === 'hidden') return true;
  return !isTextField(doc.activeElement) && doc.querySelector(OPEN_DIALOG) === null;
}
