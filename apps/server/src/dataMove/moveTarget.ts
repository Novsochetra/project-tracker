import { isPostgresUrl } from '../db/createDatabase';
import { loadS3Config, type S3Config } from '../storage/s3Config';

export interface MoveTargetSettings {
  databaseUrl: string;
  s3: S3Config;
}

// The move goes from this computer into what the online tracker reads: Railway's Postgres and the
// S3 bucket. A SQLite file or a local folder as the target could only be a slip, and each was one:
// an empty $DB made "?sslmode=require" a SQLite file that took every row while the run said
// "Done.", and a file path naming the source another way migrated the user's own tracker. Values
// are never shown, since a pasted one may hold the password.
export function moveTargetSettings(env: NodeJS.ProcessEnv): MoveTargetSettings {
  const databaseUrl = env.DATABASE_URL?.trim() ?? '';
  if (!databaseUrl) {
    throw new Error(
      "Set DATABASE_URL to the Postgres service's DATABASE_PUBLIC_URL (with PGSSLMODE=require).",
    );
  }
  if (!isPostgresUrl(databaseUrl)) {
    throw new Error(
      'DATABASE_URL is not a postgres:// URL (its value is not shown). The move goes only into ' +
        "Railway's Postgres: set it to the Postgres service's DATABASE_PUBLIC_URL, without quotes " +
        'or a name in front.',
    );
  }
  const s3 = loadS3Config(env);
  if (!s3) {
    throw new Error(
      'Set S3_BUCKET, AWS_REGION and the AWS keys (they are in .env): files go only to the S3 ' +
        'bucket the online tracker reads, never to a folder on this computer.',
    );
  }
  return { databaseUrl, s3 };
}
