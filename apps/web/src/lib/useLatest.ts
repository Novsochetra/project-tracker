import { useLayoutEffect, useRef, type RefObject } from 'react';

// For callbacks that run later (timers, requests, other components) and must see this render.
export function useLatest<T>(value: T): RefObject<T> {
  const ref = useRef(value);
  useLayoutEffect(() => {
    ref.current = value;
  });
  return ref;
}
