import { useEffect, type RefObject } from 'react';
import { hasLineBreak, oneLineInsert } from './oneLine';

const BREAK_INPUTS = new Set(['insertParagraph', 'insertLineBreak']);
const TEXT_INPUTS = new Set(['insertText', 'insertFromPaste']);

const textOf = (event: InputEvent): string | null =>
  event.data ?? event.dataTransfer?.getData('text/plain') ?? null;

// The browser's own insert keeps the field's undo history, so Cmd+Z takes back a paste. Where it
// is missing (jsdom, old browsers) the text goes in by script, cut to the length limit.
function insertAtSelection(field: HTMLTextAreaElement, text: string): void {
  const { selectionStart, selectionEnd, maxLength, value } = field;
  if (text === '' && selectionStart === selectionEnd) return;
  const focused = document.activeElement === field;
  if (focused && typeof document.execCommand === 'function') {
    if (document.execCommand('insertText', false, text)) return;
  }
  const room =
    maxLength < 0 ? text.length : maxLength - value.length + selectionEnd - selectionStart;
  field.setRangeText(text.slice(0, Math.max(room, 0)), selectionStart, selectionEnd, 'end');
  field.dispatchEvent(new Event('input', { bubbles: true }));
}

// Line breaks turn into spaces before they land. WebKit inserts a keyboard's multi-line text
// (dictation, clipboard keyboards, text replacements) one line at a time, and a value set by
// script between the lines ends the insert, dropping the rest. So a break on its own leaves the
// text after the caret alone: the next line of the same insert may still come.
export function insertOnOneLine(event: InputEvent): void {
  const field = event.currentTarget as HTMLTextAreaElement;
  if (!event.cancelable) return;
  const { value, selectionStart, selectionEnd } = field;
  const before = value.slice(0, selectionStart);
  if (BREAK_INPUTS.has(event.inputType)) {
    event.preventDefault();
    insertAtSelection(field, oneLineInsert('\n', before, ''));
    return;
  }
  const text = TEXT_INPUTS.has(event.inputType) ? textOf(event) : null;
  if (text === null || !hasLineBreak(text)) return;
  event.preventDefault();
  insertAtSelection(field, oneLineInsert(text, before, value.slice(selectionEnd)));
}

export function useOneLineInserts(ref: RefObject<HTMLTextAreaElement | null>): void {
  useEffect(() => {
    const field = ref.current;
    if (!field) return;
    field.addEventListener('beforeinput', insertOnOneLine);
    return () => field.removeEventListener('beforeinput', insertOnOneLine);
  }, [ref]);
}
