import { headerPath, sidePath } from './gitPath';
import type { DiffFile } from './types';

export const FILE_START = 'diff --git ';

export function newFile(line: string): DiffFile {
  const path = headerPath(line.slice(FILE_START.length));
  return {
    path,
    oldPath: path,
    status: 'modified',
    binary: false,
    hunks: [],
    additions: 0,
    deletions: 0,
    digest: '',
  };
}

const after = (line: string, start: string) => line.slice(start.length);

// The lines between `diff --git` and the first hunk say what happened to the file.
export function readHeaderLine(file: DiffFile, line: string): void {
  if (line.startsWith('new file mode')) file.status = 'added';
  else if (line.startsWith('deleted file mode')) file.status = 'deleted';
  else if (line.startsWith('rename from ')) {
    file.status = 'renamed';
    file.oldPath = sidePath(after(line, 'rename from ')) ?? file.oldPath;
  } else if (line.startsWith('rename to ')) {
    file.path = sidePath(after(line, 'rename to ')) ?? file.path;
  } else if (line.startsWith('Binary files ') || line.startsWith('GIT binary patch')) {
    file.binary = true;
  } else if (line.startsWith('--- ')) {
    file.oldPath = sidePath(after(line, '--- ')) ?? file.oldPath;
  } else if (line.startsWith('+++ ')) {
    file.path = sidePath(after(line, '+++ ')) ?? file.path;
  }
}
