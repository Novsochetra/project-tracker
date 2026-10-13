import { useInstantLayoutTransition } from 'motion/react';

// Motion's instant transition does nothing at all while no layout element is on the page (an
// empty labels list), so the update then runs as it is.
export function useInPlace(): (update: () => void) => void {
  const instant = useInstantLayoutTransition();
  return (update) => {
    let ran = false;
    instant(() => {
      ran = true;
      update();
    });
    if (!ran) update();
  };
}
