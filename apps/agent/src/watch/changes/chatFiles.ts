import { CHAT_FILES_MAX, type ChatChangedFile } from '@tracker/shared';

export interface MergedFiles {
  files: ChatChangedFile[];
  cut: boolean;
}

// A file keeps what it was when the chat first changed it: dirty before then means some of its
// changes are the person's own.
export function mergeChatFiles(
  previous: readonly ChatChangedFile[],
  turnPaths: readonly string[],
  dirtyAtStart: ReadonlySet<string>,
): MergedFiles {
  const known = new Set(previous.map((file) => file.path));
  const added = turnPaths
    .filter((path) => !known.has(path))
    .map((path) => ({ path, dirtyBefore: dirtyAtStart.has(path) }));
  const all = [...previous, ...added];
  return { files: all.slice(0, CHAT_FILES_MAX), cut: all.length > CHAT_FILES_MAX };
}
