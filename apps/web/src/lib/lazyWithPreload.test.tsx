import { act, render, screen } from '@testing-library/react';
import { Suspense, type ComponentType } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { ErrorBoundary } from './ErrorBoundary';
import { lazyWithPreload } from './lazyWithPreload';

function Greeting({ name }: { name: string }) {
  return <p>Hello {name}</p>;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

const shown = (Part: ComponentType<{ name: string }>) => (
  <ErrorBoundary name="Part" fallback={<p>Failed</p>}>
    <Suspense fallback={<p>Loading</p>}>
      <Part name="Dara" />
    </Suspense>
  </ErrorBoundary>
);

let consoleError: MockInstance<typeof console.error>;

beforeEach(() => {
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  consoleError.mockRestore();
});

describe('lazyWithPreload', () => {
  it('shows the fallback until its code arrives, then the part', async () => {
    const code = deferred<typeof Greeting>();
    const Part = lazyWithPreload(() => code.promise);
    render(shown(Part));
    expect(screen.getByText('Loading')).toBeInTheDocument();
    await act(async () => {
      code.resolve(Greeting);
      await code.promise;
    });
    expect(screen.getByText('Hello Dara')).toBeInTheDocument();
  });

  it('renders at once, without a fallback, once preloaded', async () => {
    const Part = lazyWithPreload(() => Promise.resolve(Greeting));
    await Part.preload();
    render(shown(Part));
    expect(screen.getByText('Hello Dara')).toBeInTheDocument();
    expect(screen.queryByText('Loading')).not.toBeInTheDocument();
  });

  it('loads its code once, however often it is preloaded or shown', async () => {
    const load = vi.fn(() => Promise.resolve(Greeting));
    const Part = lazyWithPreload(load);
    const first = Part.preload();
    expect(Part.preload()).toBe(first);
    await first;
    render(shown(Part));
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('says whether its code is in', async () => {
    const code = deferred<typeof Greeting>();
    const Part = lazyWithPreload(() => code.promise);
    expect(Part.isLoaded()).toBe(false);
    const preloaded = Part.preload();
    expect(Part.isLoaded()).toBe(false);
    code.resolve(Greeting);
    await preloaded;
    expect(Part.isLoaded()).toBe(true);
  });

  it('hands a failed load to the error boundary, and preload rejects with it', async () => {
    const code = deferred<typeof Greeting>();
    const Part = lazyWithPreload(() => code.promise);
    const preloaded = Part.preload();
    render(shown(Part));
    const failure = new Error('Failed to fetch dynamically imported module');
    await act(async () => {
      code.reject(failure);
      await preloaded.catch(() => undefined);
    });
    await expect(preloaded).rejects.toBe(failure);
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });
});
