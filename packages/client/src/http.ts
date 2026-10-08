import type { Actor, ErrorBody } from '@tracker/shared';
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

// The web app's service worker leaves requests with this header to the network.
export const FRESH_READ_HEADER = 'x-tracker-fresh';

export interface ReadOptions {
  // Skips every cache on the way, the browser's and the web app's service worker, so the answer
  // comes from the server or the read fails. For decisions a stale answer would get wrong.
  fresh?: boolean;
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
    const isForm = options.body instanceof FormData;
    const hasJson = options.body !== undefined && !isForm;
    const headers = this.headers(hasJson);
    if (options.fresh) headers.set(FRESH_READ_HEADER, '1');
    const response = await this.fetchImpl(this.url(path, options.query), {
      method,
      headers,
      body: isForm
        ? (options.body as FormData)
        : hasJson
          ? JSON.stringify(options.body)
          : undefined,
      ...(options.fresh ? { cache: 'no-store' as const } : {}),
      ...(options.signal ? { signal: options.signal } : {}),
    });
    return this.read<T>(response, options.allowEmpty ?? false);
  }

  async upload<T>(path: string, form: FormData, options: UploadOptions = {}): Promise<T> {
    if (!options.onProgress || !canReportProgress()) {
      return this.request<T>('POST', path, { body: form, signal: options.signal });
    }
    const answer = await postWithProgress(this.url(path), this.headers(false), form, options);
    return parseAnswer<T>(answer, false);
  }

  async raw(path: string): Promise<Response> {
    const response = await this.fetchImpl(this.url(path), { headers: this.headers(false) });
    if (!response.ok) await this.read(response, false);
    return response;
  }

  private async read<T>(response: Response, allowEmpty: boolean): Promise<T> {
    const { status, statusText } = response;
    const text = status === 204 ? '' : await response.text();
    return parseAnswer<T>({ status, statusText, text }, allowEmpty);
  }
}
