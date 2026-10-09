// Railway sets RAILWAY_ENVIRONMENT_ID in every deployment (docs/deploy-railway.md).
export const onRailway = (env: NodeJS.ProcessEnv): boolean => Boolean(env.RAILWAY_ENVIRONMENT_ID);

const isSet = (env: NodeJS.ProcessEnv, name: string): boolean => Boolean(env[name]?.trim());

// A deployment's own disk is replaced by the next deploy, so a tracker left on the local defaults
// would lose its data and files without a word. Stopping at start shows up as a failed deploy.
export function railwayProblems(env: NodeJS.ProcessEnv): string[] {
  const problems: string[] = [];
  if (!isSet(env, 'DATABASE_URL')) {
    problems.push(
      'DATABASE_URL is not set: on Railway set it to ${{Postgres.DATABASE_URL}}, or the data is lost on the next deploy.',
    );
  }
  if (!isSet(env, 'S3_BUCKET') && !isSet(env, 'UPLOADS_DIR')) {
    problems.push(
      'S3_BUCKET is not set: on Railway files go to S3 (docs/s3-storage.md), or to UPLOADS_DIR on a volume, or they are lost on the next deploy.',
    );
  }
  return problems;
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
