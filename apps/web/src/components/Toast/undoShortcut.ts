import { isEditable } from '../../lib/editable';

export type ShortcutKey = Pick<
  KeyboardEvent,
  | 'key'
  | 'metaKey'
  | 'ctrlKey'
  | 'altKey'
  | 'shiftKey'
  | 'repeat'
  | 'isComposing'
  | 'defaultPrevented'
>;

export const UNDO_KEYS = 'Meta+Z Control+Z';

// ⌘Z, or Ctrl+Z on other systems. A text field with focus keeps it for undoing its own typing.
export function isUndoShortcut(event: ShortcutKey, focused: Element | null): boolean {
  if (event.defaultPrevented || event.repeat || event.isComposing) return false;
  if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return false;
  return event.key.toLowerCase() === 'z' && !isEditable(focused);
}
