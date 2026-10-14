import type { DiffFile, DiffHunk, DiffLine } from './types';

export interface HunkState {
  hunk: DiffHunk;
  oldNext: number;
  newNext: number;
  oldLeft: number;
  newLeft: number;
}

const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

const count = (text: string | undefined) => (text === undefined ? 1 : Number(text));

export function startHunk(file: DiffFile, line: string): HunkState | null {
  const match = HUNK_HEADER.exec(line);
  if (!match) return null;
  const hunk: DiffHunk = { header: line, lines: [] };
  file.hunks.push(hunk);
  return {
    hunk,
    oldNext: Number(match[1]),
    oldLeft: count(match[2]),
    newNext: Number(match[3]),
    newLeft: count(match[4]),
  };
}

export const hunkOpen = (state: HunkState | null): state is HunkState =>
  state !== null && (state.oldLeft > 0 || state.newLeft > 0);

function lineOf(state: HunkState, mark: string, text: string): DiffLine | null {
  if (mark === '+') {
    state.newLeft -= 1;
    return { kind: 'add', text, oldLine: null, newLine: state.newNext++ };
  }
  if (mark === '-') {
    state.oldLeft -= 1;
    return { kind: 'del', text, oldLine: state.oldNext++, newLine: null };
  }
  if (mark !== ' ' && mark !== '') return null;
  state.oldLeft -= 1;
  state.newLeft -= 1;
  return { kind: 'context', text, oldLine: state.oldNext++, newLine: state.newNext++ };
}

// "\ No newline at end of file" belongs to the line before it and counts as no line.
export function addHunkLine(file: DiffFile, state: HunkState, line: string): void {
  const mark = line.slice(0, 1);
  if (mark === '\\') return;
  const diffLine = lineOf(state, mark, line.slice(1));
  if (!diffLine) {
    state.oldLeft = 0;
    state.newLeft = 0;
    return;
  }
  state.hunk.lines.push(diffLine);
  if (diffLine.kind === 'add') file.additions += 1;
  if (diffLine.kind === 'del') file.deletions += 1;
}
