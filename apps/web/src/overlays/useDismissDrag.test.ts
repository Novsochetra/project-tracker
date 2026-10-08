import { renderHook, waitFor } from '@testing-library/react';
import { motionValue } from 'motion/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { skipAnimations } from './testing';
import { useDismissDrag } from './useDismissDrag';

let restore: () => void;

beforeEach(() => {
  restore = skipAnimations();
});

afterEach(() => {
  restore();
});

function renderDrag(open: boolean) {
  const y = motionValue(0);
  const releaseVelocityRef = { current: 0 };
  const onClose = vi.fn();
  const { result } = renderHook(() =>
    useDismissDrag({
      enabled: true,
      open,
      y,
      travel: motionValue(600),
      measureTravel: () => 600,
      releaseVelocityRef,
      onClose,
    }),
  );
  const drag = result.current;
  drag.onStart();
  drag.onMove(300);
  drag.onEnd(1200);
  return { y, releaseVelocityRef, onClose };
}

it('hands the release speed to the exit when the sheet closes', () => {
  const { releaseVelocityRef, onClose } = renderDrag(false);
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(releaseVelocityRef.current).toBe(1200);
});

it('springs back and forgets the release speed when the owner keeps the sheet open', async () => {
  const { y, releaseVelocityRef, onClose } = renderDrag(true);
  expect(onClose).toHaveBeenCalledTimes(1);
  await waitFor(() => expect(y.get()).toBe(0));
  // A later close (Discard changes) must slide out normally, not with this old flick.
  expect(releaseVelocityRef.current).toBe(0);
});
