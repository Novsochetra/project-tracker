const LINE_BREAK = /\s*[\r\n]\s*/g;

export const oneLine = (text: string): string => text.replace(LINE_BREAK, ' ');

// Paste, drop and some keyboards can still put line breaks in a field whose Enter is taken.
// The caret stays after the text it followed, so typing goes on where it was.
export function keepOneLine(field: HTMLTextAreaElement): string {
  const { value, selectionEnd } = field;
  const flat = oneLine(value);
  if (flat === value) return value;
  const caret = oneLine(value.slice(0, selectionEnd)).length;
  field.value = flat;
  field.setSelectionRange(caret, caret);
  return flat;
}
