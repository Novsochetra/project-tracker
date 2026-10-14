import { keepsLocation, type Attachment } from '@tracker/shared';

// The tracker gives Claude no photo it couldn't strip of where it was taken (PT-233).
export function withheldText(files: readonly Attachment[]): string | null {
  const names = files.filter((file) => keepsLocation(file.mimeType)).map((file) => file.fileName);
  if (names.length === 0) return null;
  const its = names.length === 1 ? 'its' : 'their';
  return `Claude won't get ${names.join(', ')}: the tracker can't remove ${its} location.`;
}
