import { FILE_NAME_HEADER, type Actor, type ErrorBody } from '@tracker/shared';
import { canReportProgress, postWithProgress, type Answer, type UploadOptions } from './upload';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface HttpOptions {
  baseUrl: string;
  actor?: Actor;
  token?: string;
  fetch?: typeof fetch;
}

type Query = Record<string, string | undefined>;

// The web app's service worker never answers a read with this header from its cache; it still
// stores the answer, so its saved copy catches up.
export const FRESH_READ_HEADER = 'x-tracker-fresh';

export interface ReadOptions {
  // The answer comes from the server or the read fails: the browser's HTTP cache is skipped, and
  // the web app's service worker passes the read on without answering it from its cache. For
  // decisions a stale answer would get wrong.
  fresh?: boolean;
}

export interface UploadFile {
  blob: Blob;
  name: string;
  query?: Query;
}

export interface RequestOptions extends ReadOptions {
  body?: unknown;
  query?: Query;
  allowEmpty?: boolean;
  signal?: AbortSignal | undefined;
}

const isErrorBody = (value: unknown): value is ErrorBody => {
  const error = (value as Partial<ErrorBody> | null)?.error;
  return typeof error?.code === 'string' && typeof error.message === 'string';
};

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function toApiError({ status, statusText, text }: Answer): ApiError {
  const data = parseJson(text);
  const { code, message } = isErrorBody(data)
    ? data.error
    : { code: 'http_error', message: statusText };
  return new ApiError(status, code, message);
}

function parseAnswer<T>(answer: Answer, allowEmpty: boolean): T {
  if (answer.status === 204) return (allowEmpty ? null : undefined) as T;
  if (answer.status < 200 || answer.status > 299) throw toApiError(answer);
  return (answer.text ? JSON.parse(answer.text) : null) as T;
}

function buildQuery(query: Query | undefined): string {
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== '') params.set(name, value);
  }
  const text = params.toString();
  return text ? `?${text}` : '';
}

export class Http {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: HttpOptions) {
    this.fetchImpl = options.fetch ?? ((...args) => globalThis.fetch(...args));
  }

  url(path: string, query?: Query): string {
    return `${this.options.baseUrl.replace(/\/$/, '')}${path}${buildQuery(query)}`;
  }

  headers(json: boolean): Headers {
    const headers = new Headers();
    if (json) headers.set('content-type', 'application/json');
    if (this.options.token) headers.set('authorization', `Bearer ${this.options.token}`);
    if (this.options.actor) {
      headers.set('x-actor-kind', this.options.actor.kind);
      headers.set('x-actor-name', encodeURIComponent(this.options.actor.name));
    }
    return headers;
  }

  async request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
    const hasJson = options.body !== undefined;
    const headers = this.headers(hasJson);
    if (options.fresh) headers.set(FRESH_READ_HEADER, '1');
    const response = await this.fetchImpl(this.url(path, options.query), {
      method,
      headers,
      body: hasJson ? JSON.stringify(options.body) : undefined,
      ...(options.fresh ? { cache: 'no-store' as const } : {}),
      ...(options.signal ? { signal: options.signal } : {}),
    });
    return this.read<T>(response, options.allowEmpty ?? false);
  }

  // The file itself is the body, so the server can write it to disk as it arrives; a form would
  // have to be read whole first.
  async upload<T>(path: string, file: UploadFile, options: UploadOptions = {}): Promise<T> {
    const url = this.url(path, file.query);
    const headers = this.headers(false);
    headers.set('content-type', file.blob.type || 'application/octet-stream');
    headers.set(FILE_NAME_HEADER, encodeURIComponent(file.name));
    if (options.onProgress && canReportProgress()) {
      return parseAnswer<T>(await postWithProgress(url, headers, file.blob, options), false);
    }
    const response = await this.fetchImpl(url, {
      method: 'POST',
      headers,
      body: file.blob,
      ...(options.signal ? { signal: options.signal } : {}),
    });
    return this.read<T>(response, false);
  }

  async raw(path: string, { signal }: { signal?: AbortSignal } = {}): Promise<Response> {
    const response = await this.fetchImpl(this.url(path), {
      headers: this.headers(false),
      ...(signal ? { signal } : {}),
    });
    if (!response.ok) await this.read(response, false);
    return response;
  }

  private async read<T>(response: Response, allowEmpty: boolean): Promise<T> {
    const { status, statusText } = response;
    const text = status === 204 ? '' : await response.text();
    return parseAnswer<T>({ status, statusText, text }, allowEmpty);
  }
}
