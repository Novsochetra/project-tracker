import { useEffect, useState } from 'react';

// The first frame's callback runs before that frame paints, so it takes a second one.
export function usePainted(): boolean {
  const [painted, setPainted] = useState(false);
  useEffect(() => {
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => setPainted(true));
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  return painted;
}
