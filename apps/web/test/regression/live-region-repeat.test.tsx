import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { announce } from '../../src/app/announce';
import { LiveRegion } from '../../src/app/LiveRegion';

// Screen readers speak what newly appears in a live region. The region kept one text, so a
// second "MOB-1 moved" on the next arrow press changed nothing and nothing was read.

function spoken(records: MutationRecord[]): string[] {
  const texts = records.flatMap((record) =>
    record.type === 'characterData'
      ? [record.target.textContent ?? '']
      : [...record.addedNodes].map((node) => node.textContent ?? ''),
  );
  return texts.filter((text) => text !== '');
}

function listen(region: HTMLElement): () => string[] {
  const observer = new MutationObserver(() => undefined);
  observer.observe(region, { childList: true, subtree: true, characterData: true });
  return () => {
    const heard = spoken(observer.takeRecords());
    observer.disconnect();
    return heard;
  };
}

afterEach(() => {
  vi.useRealTimers();
  announce('');
});

describe('regression: the live region announces every message', () => {
  it('announces the same text twice', () => {
    render(<LiveRegion />);
    const heard = listen(screen.getByRole('status'));

    act(() => announce('MOB-1 moved'));
    act(() => announce('MOB-1 moved'));

    expect(heard()).toEqual(['MOB-1 moved', 'MOB-1 moved']);
  });

  it('clears the text after a while so nothing stale is left to read', () => {
    vi.useFakeTimers();
    render(<LiveRegion />);

    act(() => announce('MOB-1 moved'));
    expect(screen.getByRole('status')).toHaveTextContent('MOB-1 moved');
    act(() => void vi.advanceTimersByTime(10_000));

    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });
});
