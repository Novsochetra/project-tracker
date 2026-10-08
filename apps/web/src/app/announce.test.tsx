import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { announce, ANNOUNCEMENT_CLEAR_MS, clearAnnouncement } from './announce';
import { LiveRegion } from './LiveRegion';

const region = () => screen.getByRole('status');

beforeEach(() => {
  vi.useFakeTimers();
  render(<LiveRegion />);
});

afterEach(() => {
  act(() => announce(''));
  vi.useRealTimers();
});

describe('announce', () => {
  it('shows the latest message until it is cleared', () => {
    act(() => announce('MOB-1 moved'));
    act(() => announce('MOB-2 moved'));
    expect(region()).toHaveTextContent(/^MOB-2 moved$/);

    act(() => announce(''));
    expect(region()).toBeEmptyDOMElement();
  });

  it('gives a newer message its own time before clearing it', () => {
    act(() => announce('MOB-1 moved'));
    act(() => void vi.advanceTimersByTime(ANNOUNCEMENT_CLEAR_MS - 1));
    act(() => announce('MOB-2 moved'));
    act(() => void vi.advanceTimersByTime(ANNOUNCEMENT_CLEAR_MS - 1));
    expect(region()).toHaveTextContent('MOB-2 moved');

    act(() => void vi.advanceTimersByTime(1));
    expect(region()).toBeEmptyDOMElement();
  });
});

describe('clearAnnouncement', () => {
  it('takes back its own message', () => {
    act(() => announce('Offline'));
    act(() => clearAnnouncement('Offline'));
    expect(region()).toBeEmptyDOMElement();
  });

  it('leaves a newer message alone', () => {
    act(() => announce('Offline'));
    act(() => announce('MOB-1 moved'));
    act(() => clearAnnouncement('Offline'));
    expect(region()).toHaveTextContent('MOB-1 moved');
  });
});
