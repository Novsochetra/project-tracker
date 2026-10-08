const LINE_BREAK = /\s*[\r\n]\s*/g;
const HAS_LINE_BREAK = /[\r\n]/;
const LEADING_BREAK = /^\s*[\r\n]\s*/;
const TRAILING_BREAK = /\s*[\r\n]\s*$/;
const EMPTY_OR_SPACE_AT_END = /(^|\s)$/;
const SPACE_AT_START = /^\s/;

export const hasLineBreak = (text: string): boolean => HAS_LINE_BREAK.test(text);

export const oneLine = (text: string): string => text.replace(LINE_BREAK, ' ');

// A break becomes a space only where it separates words: not at the start of the field, and not
// next to a space that is already there.
export function oneLineInsert(text: string, before: string, after: string): string {
  let insert = text;
  if (EMPTY_OR_SPACE_AT_END.test(before)) insert = insert.replace(LEADING_BREAK, '');
  if (SPACE_AT_START.test(after)) insert = insert.replace(TRAILING_BREAK, '');
  return oneLine(insert);
}

// For inserts that reach the field without a cancelable beforeinput, such as a drop. The caret
// stays after the text it followed, so typing goes on where it was.
export function keepOneLine(field: HTMLTextAreaElement): string {
  const { value, selectionEnd } = field;
  const flat = oneLine(value);
  if (flat === value) return value;
  const caret = oneLine(value.slice(0, selectionEnd)).length;
  field.value = flat;
  field.setSelectionRange(caret, caret);
  return flat;
}
