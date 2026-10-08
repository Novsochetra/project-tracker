import { act, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MIN_BOARD_HEIGHT, useFillHeight } from './useBoardLayout';

function Screen() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  useFillHeight(frameRef, scrollRef);
  return (
    <div ref={scrollRef} data-testid="scroller">
      <div data-testid="filters" />
      <div ref={frameRef} data-testid="frame" />
    </div>
  );
}

// jsdom has no layout: the scroller is `screenHeight` tall and the board starts 210px down it.
let screenHeight = 800;
const testId = (element: HTMLElement) => element.dataset.testid;

beforeEach(() => {
  screenHeight = 800;
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(function (
    this: HTMLElement,
  ) {
    return testId(this) === 'scroller' ? screenHeight : 0;
  });
  vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockImplementation(function (
    this: HTMLElement,
  ) {
    return testId(this) === 'frame' ? 210 : 0;
  });
  vi.spyOn(HTMLElement.prototype, 'offsetParent', 'get').mockImplementation(function (
    this: HTMLElement,
  ) {
    return testId(this) === 'frame' ? screen.getByTestId('scroller') : null;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

const boardHeight = () => screen.getByTestId('frame').style.getPropertyValue('--board-height');

describe('useFillHeight', () => {
  it('gives the board the rest of the screen below it', () => {
    render(<Screen />);
    expect(boardHeight()).toBe('590px');
  });

  it('follows the screen when it resizes, down to a minimum', () => {
    render(<Screen />);
    screenHeight = 640;
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });
    expect(boardHeight()).toBe('430px');
    screenHeight = 400;
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });
    expect(boardHeight()).toBe(`${MIN_BOARD_HEIGHT}px`);
  });
});
