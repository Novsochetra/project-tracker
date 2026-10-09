export interface S3Config {
  bucket: string;
  region: string;
  // An S3-compatible store (MinIO, Cloudflare R2…); null for AWS itself.
  endpoint: string | null;
}

// The AWS SDK reads these itself; they are checked here so a missing one stops the server at start
// instead of failing the first upload.
const CREDENTIALS = ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'] as const;

const BUCKET_NAME = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/;

const valueOf = (env: NodeJS.ProcessEnv, name: string): string => env[name]?.trim() ?? '';

function checkEndpoint(endpoint: string): string | null {
  if (!endpoint) return null;
  const url = URL.canParse(endpoint) ? new URL(endpoint) : null;
  if (url?.protocol === 'http:' || url?.protocol === 'https:') return endpoint;
  throw new Error('S3_ENDPOINT must be an http or https URL, such as https://s3.example.com.');
}

function checkCredentials(env: NodeJS.ProcessEnv): void {
  const missing = CREDENTIALS.filter((name) => !valueOf(env, name));
  if (missing.length === 0) return;
  const verb = missing.length === 1 ? 'is' : 'are';
  throw new Error(`S3_BUCKET is set but ${missing.join(' and ')} ${verb} not.`);
}

function checkBucket(bucket: string): string {
  if (BUCKET_NAME.test(bucket)) return bucket;
  throw new Error(
    `S3_BUCKET must be a bucket name (3-63 lowercase letters, digits, dots or hyphens), not "${bucket}".`,
  );
}

// S3 when a bucket is named, disk otherwise. Half of the settings stops the server at start:
// without the bucket, files would quietly stay on a disk Railway wipes on every deploy; without the
// region or a key, every upload would fail.
export function loadS3Config(env: NodeJS.ProcessEnv): S3Config | null {
  const bucket = valueOf(env, 'S3_BUCKET');
  const endpoint = valueOf(env, 'S3_ENDPOINT');
  if (!bucket) {
    if (endpoint) throw new Error('S3_ENDPOINT is set but S3_BUCKET is not.');
    return null;
  }
  const region = valueOf(env, 'AWS_REGION');
  if (!region) throw new Error("S3_BUCKET is set but AWS_REGION is not (the bucket's region).");
  checkCredentials(env);
  return { bucket: checkBucket(bucket), region, endpoint: checkEndpoint(endpoint) };
}
