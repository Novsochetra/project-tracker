// A small model of how WebKit edits a text area, enough to replay a keyboard's multi-line insert
// (dictation, clipboard keyboards, text replacements). WebKit cuts the text to the length limit,
// then inserts it one step per line and per line break, each a cancelable beforeinput and, unless
// cancelled, the change and an input event. A script that sets the value while the insert is under
// way ends it: the steps left change nothing. document.execCommand('insertText') is the browser's
// own insert, also allowed mid-step.

const LINE_BREAK = /\r\n?|\n/;

function roomFor(field: HTMLTextAreaElement, text: string): string {
  const { selectionStart, selectionEnd, maxLength, value } = field;
  const room =
    maxLength < 0 ? text.length : maxLength - value.length + selectionEnd - selectionStart;
  return text.slice(0, Math.max(room, 0));
}

// False when a script changed the value during the step, which ends the insert.
function step(field: HTMLTextAreaElement, inputType: string, data: string | null): boolean {
  const init = { inputType, data, bubbles: true };
  if (!field.dispatchEvent(new InputEvent('beforeinput', { ...init, cancelable: true }))) {
    return true;
  }
  const { selectionStart, selectionEnd } = field;
  field.setRangeText(roomFor(field, data ?? '\n'), selectionStart, selectionEnd, 'end');
  const inserted = field.value;
  field.dispatchEvent(new InputEvent('input', init));
  return field.value === inserted;
}

export function webkitInsertText(field: HTMLTextAreaElement, text: string): void {
  const steps = roomFor(field, text)
    .split(LINE_BREAK)
    .flatMap((line, index) => [...(index > 0 ? [null] : []), ...(line ? [line] : [])]);
  for (const data of steps) {
    if (!step(field, data === null ? 'insertParagraph' : 'insertText', data)) return;
  }
}

// jsdom lacks the browser's insert command.
export function installExecCommand(): () => void {
  const execCommand = (command: string, _showUi?: boolean, text = ''): boolean => {
    const field = document.activeElement;
    if (command !== 'insertText' || !(field instanceof HTMLTextAreaElement)) return false;
    step(field, 'insertText', text);
    return true;
  };
  Object.defineProperty(document, 'execCommand', { configurable: true, value: execCommand });
  return () => Reflect.deleteProperty(document, 'execCommand');
}
