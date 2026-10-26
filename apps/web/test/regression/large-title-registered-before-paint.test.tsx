import { render } from '@testing-library/react';
import { useLayoutEffect, useRef } from 'react';
import { afterEach, expect, it } from 'vitest';
import { mockPhone } from '../../src/overlays/testing';
import { LargeTitle } from '../../src/navigation/LargeTitle';
import { createLargeTitleStore } from '../../src/navigation/largeTitleStore';
import { ScreenContext, type ScreenState } from '../../src/navigation/ScreenContext';

// Switching between the Projects and Activity tabs mounts a new screen. Its large title told the
// nav bar it was there in a passive effect, after the first paint, so the nav bar's small title
// showed for a frame and then faded out: the title seemed to glitch.

let restore: () => void = () => undefined;

afterEach(() => restore());

it('has the large title registered before the first paint', () => {
  restore = mockPhone(true);
  const largeTitle = createLargeTitleStore();
  const state: ScreenState = {
    route: { name: 'activity' },
    isTop: true,
    scrollRef: { current: null },
    largeTitle,
  };
  let atFirstPaint = largeTitle.get();
  function Probe() {
    const done = useRef(false);
    useLayoutEffect(() => {
      if (done.current) return;
      done.current = true;
      atFirstPaint = largeTitle.get();
    });
    return null;
  }
  render(
    <ScreenContext value={state}>
      <LargeTitle>Activity</LargeTitle>
      <Probe />
    </ScreenContext>,
  );
  expect(atFirstPaint).toEqual({ present: true, visible: true });
});
