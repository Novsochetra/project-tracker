import type { Db } from '../db/schema';
import type { FileStorage } from '../storage/fileStorage';
import { copyFiles } from './copyFiles';
import { textsNamingOldFiles, type MovedAttachment } from './movedAttachment';
import { targetProblems } from './plan';
import { insertRows, readRows, rowCounts, type TableRows } from './rows';
import { openSourceCopy } from './sourceCopy';
import { findSourceFiles, sourceFileProblems, totalBytes, type SourceFile } from './sourceFiles';
import {
  checkedLine,
  compressionLine,
  compressionTotals,
  planLines,
  renamedTextsLine,
} from './summary';
import { stoppedError, type MovePhase } from './stopped';
import { prepareTargetSchema } from './targetSchema';
import { readTargetState } from './targetState';
import { placeOf, refusedImageProblems } from './refusedImages';
import { verificationProblems, verifyMove } from './verify';

export interface MoveOptions {
  // The local SQLite file and uploads folder; only ever read.
  from: string;
  uploads: string;
  dryRun: boolean;
  allowExisting: boolean;
}

export interface MoveTarget {
  db: Db;
  // Opened only once the move is about to write files: a dry run never opens it.
  openStorage: () => Promise<FileStorage>;
  say: (line: string) => void;
  // Told how far the rows got, for a stop that can't wait for the error (a signal).
  onPhase?: (phase: MovePhase) => void;
}

interface Source {
  rows: TableRows;
  files: SourceFile[];
}

interface Mover extends MoveTarget {
  setPhase: (phase: MovePhase) => void;
}

const textsOf = (rows: TableRows): string[] => [
  ...rows.tickets.flatMap((ticket) => [ticket.title, ticket.description]),
  ...rows.activities.map((activity) => activity.text),
];

function refuse(say: (line: string) => void, problems: readonly string[], dryRun: boolean) {
  say(dryRun ? 'The move would stop here:' : 'Nothing was moved:');
  for (const problem of problems) say(`  ${problem}`);
  return false;
}

function reportFiles(
  say: (line: string) => void,
  rows: TableRows,
  moved: MovedAttachment[],
  dryRun: boolean,
) {
  say(compressionLine(compressionTotals(moved), dryRun));
  for (const line of renamedTextsLine(textsNamingOldFiles(textsOf(rows), moved))) say(line);
}

function dryRun(say: (line: string) => void): boolean {
  say('Dry run: nothing was written.');
  return true;
}

// Files first, rows after: a run that fails leaves no row pointing at a missing file, only files
// that the next run writes again under the same keys.
async function apply({ rows, files }: Source, target: Mover): Promise<boolean> {
  const { db, say, setPhase } = target;
  const storage = await target.openStorage();
  const progress = (count: number) => {
    if (count % 25 === 0 || count === files.length) say(`Files: ${count} of ${files.length}.`);
  };
  const moved = await copyFiles(files, storage, progress);
  reportFiles(say, rows, moved, false);
  const movedRows = { ...rows, attachments: moved.map((file) => file.after) };
  await insertRows(db, movedRows, () => setPhase('committing'));
  setPhase('rows-written');
  say('Rows: written in one transaction.');
  const problems = verificationProblems(await verifyMove(db, storage, movedRows));
  if (problems.length > 0) {
    say('The rows were written, but the check after the move found:');
    for (const problem of problems) say(`  ${problem}`);
    return false;
  }
  say(checkedLine(rowCounts(rows)));
  return true;
}

async function readSource(db: Db, options: MoveOptions, say: MoveTarget['say']): Promise<Source> {
  const rows = await readRows(db);
  const files = await findSourceFiles(options.uploads, rows.attachments);
  const plan = planLines(rowCounts(rows), { count: files.length, bytes: totalBytes(files) });
  for (const line of plan) say(line);
  return { rows, files };
}

// Every image goes through compressImage once without storage first: one it can't store stops the
// move before a file or a row is written. The real run compresses them again as it writes, which
// costs time but no memory or temp space for a whole set of compressed copies.
async function checkFiles({ rows, files }: Source, options: MoveOptions, say: Mover['say']) {
  const missing = sourceFileProblems(options.uploads, files);
  if (missing.length > 0) return missing;
  const checked = await copyFiles(files, null);
  if (options.dryRun) reportFiles(say, rows, checked, true);
  return refusedImageProblems(checked, placeOf(rows));
}

async function moveFrom(source: Source, options: MoveOptions, target: Mover) {
  const { db, say } = target;
  const fileIssues = await checkFiles(source, options, say);
  // Before anything touches the target, which a dry run only reads.
  if (fileIssues.length > 0 && !options.dryRun) return refuse(say, fileIssues, false);
  const schemaIssues = await prepareTargetSchema(db, options.dryRun, say);
  const state = await readTargetState(db, source.rows);
  const issues = [...fileIssues, ...schemaIssues, ...targetProblems(state, options.allowExisting)];
  if (issues.length > 0) return refuse(say, issues, options.dryRun);
  return options.dryRun ? dryRun(say) : apply(source, target);
}

async function moveCopy(options: MoveOptions, target: Mover): Promise<boolean> {
  const copy = await openSourceCopy(options.from);
  try {
    if (copy.migrated.length > 0) {
      target.say(`Migrated a copy of ${options.from} (not the file): ${copy.migrated.join(', ')}.`);
    }
    return await moveFrom(await readSource(copy.db, options, target.say), options, target);
  } finally {
    await copy.close();
  }
}

// An error ends with what it means for the rows, so the user knows whether to run it again.
export async function runMove(options: MoveOptions, target: MoveTarget): Promise<boolean> {
  let phase: MovePhase = 'no-rows';
  const setPhase = (next: MovePhase) => {
    phase = next;
    target.onPhase?.(next);
  };
  try {
    return await moveCopy(options, { ...target, setPhase });
  } catch (error) {
    throw stoppedError(error, phase);
  }
}
