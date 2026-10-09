import { isAbsolute, relative, resolve } from 'node:path';
import { isPostgresUrl } from './db/createDatabase';

// Railway sets RAILWAY_ENVIRONMENT_ID in every deployment (docs/deploy-railway.md).
export const onRailway = (env: NodeJS.ProcessEnv): boolean => Boolean(env.RAILWAY_ENVIRONMENT_ID);

const isSet = (env: NodeJS.ProcessEnv, name: string): boolean => Boolean(env[name]?.trim());

// Only the service's volume outlives a deploy; Railway mounts it at RAILWAY_VOLUME_MOUNT_PATH.
function onVolume(env: NodeJS.ProcessEnv, path: string): boolean {
  const mount = env.RAILWAY_VOLUME_MOUNT_PATH?.trim();
  if (!mount) return false;
  const inside = relative(resolve(mount), resolve(path));
  return !inside.startsWith('..') && !isAbsolute(inside);
}

// A deployment's own disk is replaced by the next deploy, so a database there loses its data
// without a word. The value is never shown: one pasted with quotes still holds the password.
export function railwayDatabaseProblem(env: NodeJS.ProcessEnv): string | null {
  if (!onRailway(env)) return null;
  const url = env.DATABASE_URL ?? '';
  if (!url.trim()) {
    return 'DATABASE_URL is not set: on Railway set it to ${{Postgres.DATABASE_URL}}, or the data is lost on the next deploy.';
  }
  if (isPostgresUrl(url) || onVolume(env, url)) return null;
  return (
    'DATABASE_URL is not a postgres:// URL (its value is not shown): set it to ${{Postgres.DATABASE_URL}}, ' +
    "without quotes or a name in front. A SQLite file works only on the service's volume; anywhere else the next deploy loses it."
  );
}

function railwayStorageProblem(env: NodeJS.ProcessEnv): string | null {
  if (isSet(env, 'S3_BUCKET')) return null;
  const dir = env.UPLOADS_DIR ?? '';
  if (!dir.trim()) {
    return "S3_BUCKET is not set: on Railway files go to S3 (docs/s3-storage.md), or to UPLOADS_DIR on the service's volume, or they are lost on the next deploy.";
  }
  if (onVolume(env, dir)) return null;
  return "UPLOADS_DIR is not on the service's volume, so the next deploy loses its files: set S3_BUCKET (docs/s3-storage.md), or put UPLOADS_DIR on the volume.";
}

// Stopping at start shows up as a failed deploy, where data kept on the deployment disk would only
// be missed after the next one.
export function railwayProblems(env: NodeJS.ProcessEnv): string[] {
  if (!onRailway(env)) return [];
  return [railwayDatabaseProblem(env), railwayStorageProblem(env)].filter(
    (problem): problem is string => problem !== null,
  );
}

// Railway's edge proxy is the only way in: the server listens on every interface, trusts the one
// proxy hop for the client's address and https, and tells agents the public domain. A variable that
// is set still wins.
export function withRailwayDefaults(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  if (!onRailway(env)) return env;
  const problems = railwayProblems(env);
  if (problems.length > 0) throw new Error(problems.join('\n'));
  const domain = env.RAILWAY_PUBLIC_DOMAIN?.trim();
  return {
    ...env,
    HOST: env.HOST || '0.0.0.0',
    TRUST_PROXY: env.TRUST_PROXY || '1',
    PUBLIC_URL: env.PUBLIC_URL || (domain ? `https://${domain}` : undefined),
  };
}
