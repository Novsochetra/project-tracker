// An agent's edit of a ticket's title or description keeps the text it replaced in an event, which
// no one can edit or delete, so the person can always get their own words back (PT-276).

const CHANGED = 'changed the description';
const REMOVED = 'removed the description';

export const titleReplacedText = (oldTitle: string): string =>
  `changed the title from “${oldTitle}”`;

// Untrimmed, so the person gets back exactly what they wrote. A blank one has nothing to keep.
export function descriptionReplacedText(oldText: string, newText: string): string {
  const added = newText.trim() !== '';
  if (!oldText.trim()) return added ? 'added a description' : REMOVED;

  return `${added ? CHANGED : REMOVED}\n${oldText}`;
}

export interface ReplacedDescription {
  sentence: string;
  oldText: string;
}

export function replacedDescription(eventText: string): ReplacedDescription | null {
  const end = eventText.indexOf('\n');
  const sentence = end < 0 ? '' : eventText.slice(0, end);
  if (sentence !== CHANGED && sentence !== REMOVED) return null;

  return { sentence, oldText: eventText.slice(end + 1) };
}
