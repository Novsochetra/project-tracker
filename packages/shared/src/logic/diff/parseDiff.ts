import { fileDigest } from './fileDigest';
import { FILE_START, newFile, readHeaderLine } from './fileHeader';
import { addHunkLine, hunkOpen, startHunk, type HunkState } from './hunks';
import type { DiffFile } from './types';

interface Reading {
  file: DiffFile;
  raw: string[];
  hunk: HunkState | null;
}

const done = ({ file, raw }: Reading): DiffFile => ({
  ...file,
  digest: fileDigest(raw.join('\n')),
});

function readLine(reading: Reading, line: string): void {
  reading.raw.push(line);
  if (hunkOpen(reading.hunk)) return addHunkLine(reading.file, reading.hunk, line);
  if (line.startsWith('@@')) {
    reading.hunk = startHunk(reading.file, line) ?? reading.hunk;
    return;
  }
  if (!reading.hunk) readHeaderLine(reading.file, line);
}

// `git diff` output, possibly cut short, as files of hunks of numbered lines. Text before the
// first file is not part of any.
export function parseDiff(text: string): DiffFile[] {
  const files: DiffFile[] = [];
  let reading: Reading | null = null;
  const lines = text.split('\n');
  if (lines.at(-1) === '') lines.pop();
  for (const line of lines) {
    if (line.startsWith(FILE_START)) {
      if (reading) files.push(done(reading));
      reading = { file: newFile(line), raw: [line], hunk: null };
    } else if (reading) {
      readLine(reading, line);
    }
  }
  if (reading) files.push(done(reading));
  return files;
}
