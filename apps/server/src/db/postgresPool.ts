import pg from 'pg';

const INT8_OID = 20;

export const DEFAULT_POOL_MAX = 10;
export const DEFAULT_STATEMENT_TIMEOUT_MS = 30_000;
const CONNECT_TIMEOUT_MS = 10_000;
// A transaction left open (a request stuck between two queries) would hold its row locks forever.
const IDLE_IN_TRANSACTION_TIMEOUT_MS = 60_000;

// node-postgres reads sslmode=require as verify-full, which refuses the self-signed certificate a
// Railway database has; libpq's meaning (encrypt, don't verify) needs uselibpqcompat. Its parser
// has no 'allow', and 'no-verify' is node-postgres' own name for require.
const LIBPQ_MODES: Record<string, string> = { allow: 'disable', 'no-verify': 'require' };

export function withLibpqSslMode(url: string, env: NodeJS.ProcessEnv): string {
  if (!URL.canParse(url)) return url;
  const parsed = new URL(url);
  const mode = parsed.searchParams.get('sslmode') ?? env.PGSSLMODE;
  if (!mode) return url;
  parsed.searchParams.set('sslmode', LIBPQ_MODES[mode] ?? mode);
  parsed.searchParams.set('uselibpqcompat', 'true');
  return parsed.toString();
}

function wholeNumber(value: string | undefined, fallback: number, min: number): number {
  const number = Number(value);
  return value && Number.isInteger(number) && number >= min ? number : fallback;
}

export function postgresPoolConfig(url: string, env: NodeJS.ProcessEnv): pg.PoolConfig {
  const types = new pg.TypeOverrides();
  // Timestamps are epoch-ms bigints; they fit safely in a JS number.
  types.setTypeParser(INT8_OID, (value: string) => Number(value));
  return {
    connectionString: withLibpqSslMode(url, env),
    types,
    max: wholeNumber(env.DATABASE_POOL_MAX, DEFAULT_POOL_MAX, 1),
    connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
    statement_timeout: wholeNumber(
      env.DATABASE_STATEMENT_TIMEOUT_MS,
      DEFAULT_STATEMENT_TIMEOUT_MS,
      0,
    ),
    idle_in_transaction_session_timeout: IDLE_IN_TRANSACTION_TIMEOUT_MS,
    application_name: 'project-tracker',
  };
}

export function createPostgresPool(url: string, env: NodeJS.ProcessEnv): pg.Pool {
  const pool = new pg.Pool(postgresPoolConfig(url, env));
  // An idle connection the database drops (a restart, a network blip) emits 'error' on the pool,
  // which would end the process if nothing listened. The pool replaces it on the next query.
  pool.on('error', (error) => console.error('A Postgres connection was lost:', error.message));
  return pool;
}
