import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { ErrorBoundary } from './ErrorBoundary';

let consoleError: MockInstance<typeof console.error>;

beforeEach(() => {
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  consoleError.mockRestore();
});

function Part({ fails }: { fails: boolean }) {
  if (fails) throw new Error('Part crashed');
  return <p>Part</p>;
}

interface Case {
  fails: boolean;
  retryKey?: unknown;
  holdRetry?: boolean;
}

const boundary = ({ fails, retryKey, holdRetry }: Case) => (
  <ErrorBoundary name="Part" retryKey={retryKey} holdRetry={holdRetry} fallback={<p>Fallback</p>}>
    <Part fails={fails} />
  </ErrorBoundary>
);

describe('ErrorBoundary', () => {
  it('shows the fallback for a part that fails and logs what failed', () => {
    render(boundary({ fails: true }));
    expect(screen.getByText('Fallback')).toBeInTheDocument();
    expect(consoleError).toHaveBeenCalledWith(
      "Part couldn't be shown.",
      expect.objectContaining({ message: 'Part crashed' }),
      expect.anything(),
    );
  });

  it('stays failed without a retry key, whatever else changes', () => {
    const { rerender } = render(boundary({ fails: true }));
    rerender(boundary({ fails: false }));
    expect(screen.getByText('Fallback')).toBeInTheDocument();
  });

  it('tries the part again once its retry key changes, and only then', () => {
    const { rerender } = render(boundary({ fails: true, retryKey: 'a' }));
    rerender(boundary({ fails: false, retryKey: 'a' }));
    expect(screen.getByText('Fallback')).toBeInTheDocument();
    rerender(boundary({ fails: false, retryKey: 'b' }));
    expect(screen.getByText('Part')).toBeInTheDocument();
  });

  it('shows the fallback again when the retry fails too, without trying in a loop', () => {
    const { rerender } = render(boundary({ fails: true, retryKey: 'a' }));
    rerender(boundary({ fails: true, retryKey: 'b' }));
    expect(screen.getByText('Fallback')).toBeInTheDocument();
    rerender(boundary({ fails: false, retryKey: 'b' }));
    expect(screen.getByText('Fallback')).toBeInTheDocument();
    expect(
      consoleError.mock.calls.filter(([message]) => message === "Part couldn't be shown."),
    ).toHaveLength(2);
  });

  it('holds the retry back until it is let go', () => {
    const { rerender } = render(boundary({ fails: true, retryKey: 'a' }));
    rerender(boundary({ fails: false, retryKey: 'b', holdRetry: true }));
    expect(screen.getByText('Fallback')).toBeInTheDocument();
    rerender(boundary({ fails: false, retryKey: 'b', holdRetry: false }));
    expect(screen.getByText('Part')).toBeInTheDocument();
  });
});
