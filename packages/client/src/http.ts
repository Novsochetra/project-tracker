import type { Actor, ErrorBody } from '@tracker/shared';

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

export interface RequestOptions {
  body?: unknown;
  query?: Query;
  allowEmpty?: boolean;
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

function toApiError(response: Response, text: string): ApiError {
  const data = parseJson(text);
  const { code, message } = isErrorBody(data)
    ? data.error
    : { code: 'http_error', message: response.statusText };
  return new ApiError(response.status, code, message);
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
    const response = await this.fetchImpl(this.url(path, options.query), {
      method,
      headers: this.headers(hasJson),
      body: isForm
        ? (options.body as FormData)
        : hasJson
          ? JSON.stringify(options.body)
          : undefined,
    });
    return this.read<T>(response, options.allowEmpty ?? false);
  }

  async raw(path: string): Promise<Response> {
    const response = await this.fetchImpl(this.url(path), { headers: this.headers(false) });
    if (!response.ok) await this.read(response, false);
    return response;
  }

  private async read<T>(response: Response, allowEmpty: boolean): Promise<T> {
    if (response.status === 204) {
      if (allowEmpty) return null as T;
      return undefined as T;
    }
    const text = await response.text();
    if (!response.ok) throw toApiError(response, text);
    return (text ? JSON.parse(text) : null) as T;
  }
}
