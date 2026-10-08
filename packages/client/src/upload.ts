export interface UploadOptions {
  onProgress?: (sentBytes: number, totalBytes: number) => void;
  signal?: AbortSignal;
}

export interface Answer {
  status: number;
  statusText: string;
  text: string;
}

interface ProgressEventLike {
  lengthComputable: boolean;
  loaded: number;
  total: number;
}

// The part of XMLHttpRequest used here: browsers have it, Node (the agent CLI) doesn't, and the
// client builds without the DOM types.
interface ProgressRequest {
  open(method: string, url: string): void;
  setRequestHeader(name: string, value: string): void;
  send(body: FormData): void;
  abort(): void;
  upload: { onprogress: ((event: ProgressEventLike) => void) | null };
  onload: (() => void) | null;
  onerror: (() => void) | null;
  onabort: (() => void) | null;
  status: number;
  statusText: string;
  responseText: string;
}

type ProgressRequestClass = new () => ProgressRequest;

const requestClass = (): ProgressRequestClass | undefined =>
  (globalThis as { XMLHttpRequest?: ProgressRequestClass }).XMLHttpRequest;

export const canReportProgress = (): boolean => typeof requestClass() === 'function';

const stopped = () => new DOMException('The upload was stopped.', 'AbortError');

// XMLHttpRequest because, unlike fetch, it reports how much of the body went out.
export function postWithProgress(
  url: string,
  headers: Headers,
  form: FormData,
  { onProgress, signal }: UploadOptions,
): Promise<Answer> {
  const Xhr = requestClass();
  return new Promise((resolve, reject) => {
    if (!Xhr) {
      reject(new TypeError('This runtime cannot report upload progress.'));
      return;
    }
    if (signal?.aborted) {
      reject(stopped());
      return;
    }
    const xhr = new Xhr();
    xhr.open('POST', url);
    headers.forEach((value, name) => xhr.setRequestHeader(name, value));
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded, event.total);
    };
    xhr.onload = () =>
      resolve({ status: xhr.status, statusText: xhr.statusText, text: xhr.responseText });
    // fetch rejects with a TypeError when the network fails, and callers check for that.
    xhr.onerror = () => reject(new TypeError('Failed to fetch'));
    xhr.onabort = () => reject(stopped());
    signal?.addEventListener('abort', () => xhr.abort(), { once: true });
    xhr.send(form);
  });
}
