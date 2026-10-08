import { isValidElement, type ReactNode } from 'react';

interface Row {
  label: string;
  tone?: string;
  bold?: boolean;
}

// The text a caption shows: strings, and the children of the elements that wrap them.
export function textOf(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (isValidElement<{ children?: ReactNode }>(node)) return textOf(node.props.children);
  return '';
}

// Everything the sheet's card shows, so a next step changes it even when it keeps the same rows
// under a new question.
export const actionSheetContent = (caption: ReactNode, actions: readonly Row[]): string =>
  [
    textOf(caption),
    ...actions.map((action) => [action.label, action.tone, action.bold].join(' ')),
  ].join('\n');
