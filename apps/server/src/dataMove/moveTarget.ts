import { resolve } from 'node:path';
import { isPostgresUrl } from '../db/createDatabase';
import type { StorageSettings } from '../storage/openFileStorage';
import { loadS3Config } from '../storage/s3Config';
import type { MoveArgs } from './moveArgs';

export interface MoveTargetSettings {
  databaseUrl: string;
  storage: StorageSettings;
}

const samePath = (a: string, b: string): boolean => resolve(a) === resolve(b);

// No defaults: the server's own (data/tracker.db, data/uploads) are where the data comes from.
export function moveTargetSettings(
  env: NodeJS.ProcessEnv,
  args: Pick<MoveArgs, 'from' | 'uploads'>,
): MoveTargetSettings {
  const databaseUrl = env.DATABASE_URL?.trim() ?? '';
  if (!databaseUrl) {
    throw new Error(
      "Set DATABASE_URL to the database to move into (Railway: the Postgres service's " +
        'DATABASE_PUBLIC_URL with ?sslmode=require).',
    );
  }
  // Pasted with quotes or its name in front, a postgres:// URL reads as a SQLite path that isn't
  // there: a dry run then reported on an empty database in memory, a real run would make a file
  // named after the password. The value is never shown.
  if (!isPostgresUrl(databaseUrl) && databaseUrl.includes('://')) {
    throw new Error(
      'DATABASE_URL is neither a postgres:// URL nor a file path (its value is not shown): ' +
        'remove quotes or a name in front of it.',
    );
  }
  if (!isPostgresUrl(databaseUrl) && samePath(databaseUrl, args.from)) {
    throw new Error('DATABASE_URL is the file being moved. Point it at the target database.');
  }
  const s3 = loadS3Config(env);
  const uploadsDir = env.UPLOADS_DIR?.trim() ?? '';
  if (!s3 && !uploadsDir) {
    throw new Error(
      'Set S3_BUCKET with AWS_REGION and the AWS keys (or UPLOADS_DIR) for where the files go.',
    );
  }
  if (!s3 && samePath(uploadsDir, args.uploads)) {
    throw new Error('UPLOADS_DIR is the folder being moved. Point it at the target folder.');
  }
  return { databaseUrl, storage: { s3, uploadsDir } };
}
