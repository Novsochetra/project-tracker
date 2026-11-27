export const reorderHint = (apple: boolean, touch: boolean): string =>
  `${touch ? 'Touch and hold, then drag' : 'Drag'} to change the order, or press ${apple ? 'Option' : 'Alt'} with the up or down arrow.`;

export const movedMessage = (name: string, next: readonly string[], id: string): string =>
  `${name} moved to position ${next.indexOf(id) + 1} of ${next.length}`;
