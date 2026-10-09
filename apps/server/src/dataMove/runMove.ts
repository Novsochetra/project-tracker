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
import { describeTargetSchema, migrateTarget } from './targetSchema';
import { readTargetState } from './targetState';
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
  storage: FileStorage;
  say: (line: string) => void;
}

interface Source {
  rows: TableRows;
  files: SourceFile[];
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

async function dryRun({ rows, files }: Source, say: (line: string) => void): Promise<boolean> {
  reportFiles(say, rows, await copyFiles(files, null), true);
  say('Dry run: nothing was written.');
  return true;
}

// Files first, rows after: a run that fails leaves no row pointing at a missing file, only files
// that the next run writes again under the same keys.
async function apply({ rows, files }: Source, { db, storage, say }: MoveTarget): Promise<boolean> {
  const progress = (count: number) => {
    if (count % 25 === 0 || count === files.length) say(`Files: ${count} of ${files.length}.`);
  };
  const moved = await copyFiles(files, storage, progress);
  reportFiles(say, rows, moved, false);
  const movedRows = { ...rows, attachments: moved.map((file) => file.after) };
  await insertRows(db, movedRows);
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

async function moveFrom(source: Source, options: MoveOptions, target: MoveTarget) {
  const { db, say } = target;
  const sourceIssues = sourceFileProblems(options.uploads, source.files);
  // Before anything touches the target, which a dry run only reads.
  if (sourceIssues.length > 0 && !options.dryRun) return refuse(say, sourceIssues, false);
  const schemaIssues = options.dryRun
    ? await describeTargetSchema(db, say)
    : await migrateTarget(db, say).then(() => []);
  const state = await readTargetState(db, source.rows);
  const issues = [
    ...sourceIssues,
    ...schemaIssues,
    ...targetProblems(state, options.allowExisting),
  ];
  if (issues.length > 0) return refuse(say, issues, options.dryRun);
  return options.dryRun ? dryRun(source, say) : apply(source, target);
}

export async function runMove(options: MoveOptions, target: MoveTarget): Promise<boolean> {
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
