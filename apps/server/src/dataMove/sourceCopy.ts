import { existsSync, rmSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import SQLite from 'better-sqlite3';
import { createDatabase } from '../db/createDatabase';
import { migrateToLatest } from '../db/migrator';
import type { Db } from '../db/schema';

export interface SourceCopy {
  db: Db;
  // Migrations run on the copy, which may be older than this build.
  migrated: string[];
  close: () => Promise<void>;
}

// SQLite's online backup reads the original through its own locks, so a tracker still running on
// it is fine and its WAL is included; the original is opened read-only and never migrated.
async function backUp(file: string, copy: string): Promise<void> {
  const original = new SQLite(file, { readonly: true, fileMustExist: true });
  try {
    await original.backup(copy);
  } finally {
    original.close();
  }
}

// The copies still open: a stop by a signal can't wait for close(), and each holds the whole
// database.
const openCopies = new Set<string>();

export function removeSourceCopies(): void {
  for (const dir of openCopies) rmSync(dir, { recursive: true, force: true });
  openCopies.clear();
}

export async function openSourceCopy(file: string): Promise<SourceCopy> {
  if (!existsSync(file)) throw new Error(`There is no SQLite file at ${file}.`);
  const dir = await mkdtemp(join(tmpdir(), 'tracker-move-'));
  openCopies.add(dir);
  const remove = async () => {
    await rm(dir, { recursive: true, force: true });
    openCopies.delete(dir);
  };
  let db: Db | null = null;
  try {
    const copy = join(dir, 'source.db');
    await backUp(file, copy);
    db = createDatabase(copy);
    const migrated = await migrateToLatest(db);
    const opened = db;
    return { db: opened, migrated, close: () => opened.destroy().then(remove) };
  } catch (error) {
    await db?.destroy();
    await remove();
    throw error;
  }
}
