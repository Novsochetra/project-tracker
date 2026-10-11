import { RUN_PERMISSION_LABEL_MAX } from '../../domain/runRequest';

// Masking reads the text several times, so a huge call is cut near the limit first; the room past
// the limit keeps a secret that crosses it whole for its rule.
export const LABEL_ROOM = RUN_PERMISSION_LABEL_MAX + 1000;

// Stops once the lines pass the room, so a huge call is never formatted whole (a 15 MB call held
// the helper for seconds, PT-171 review); the label is then longer than the room, so it says it
// was cut.
export function linesWithin<T>(items: readonly T[], linesOf: (item: T) => string[]): string[] {
  const lines: string[] = [];
  let length = 0;
  for (const item of items) {
    if (length > LABEL_ROOM) break;
    for (const line of linesOf(item)) {
      lines.push(line);
      length += line.length + 1;
    }
  }
  return lines;
}
