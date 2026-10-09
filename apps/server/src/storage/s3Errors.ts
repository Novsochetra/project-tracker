interface SdkError {
  name?: string;
  Code?: string;
  $metadata?: { httpStatusCode?: number; requestId?: string };
}

const sdkErrorOf = (error: unknown): SdkError | null =>
  error !== null && typeof error === 'object' && '$metadata' in error ? (error as SdkError) : null;

export const statusOf = (error: unknown): number | undefined =>
  sdkErrorOf(error)?.$metadata?.httpStatusCode;

// S3 copies its error body onto the SDK's error, and for a wrong secret that body names the access
// key and the string it signed. Only what tells failures apart goes on, without the original as a
// cause, so a log never shows the rest (PT-122 review). Other errors (a stream's own, no network)
// pass as they are.
export function safeS3Error(operation: string, error: unknown): unknown {
  const sdk = sdkErrorOf(error);
  if (!sdk) return error;
  const name = sdk.name ?? 'S3Error';
  const code = sdk.Code && sdk.Code !== name ? ` (${sdk.Code})` : '';
  const status = sdk.$metadata?.httpStatusCode ?? 'no status';
  const request = sdk.$metadata?.requestId ?? 'none';
  return new Error(`S3 ${operation} failed: ${name}${code}, HTTP ${status}, request ${request}`);
}

export async function s3Call<T>(operation: string, request: Promise<T>): Promise<T> {
  try {
    return await request;
  } catch (error) {
    throw safeS3Error(operation, error);
  }
}
