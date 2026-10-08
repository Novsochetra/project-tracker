// A hover or the start of a press comes before the click that acts on it, so work started here is
// under way, or done, when the click lands.
const PRESS_EVENTS = ['pointerover', 'pointerdown', 'keydown'] as const;

export function onFirstPress(run: () => void, target: EventTarget = window): () => void {
  const stop = () => {
    for (const type of PRESS_EVENTS) target.removeEventListener(type, start, true);
  };
  const start = () => {
    stop();
    run();
  };
  for (const type of PRESS_EVENTS) {
    target.addEventListener(type, start, { capture: true, passive: true });
  }
  return stop;
}
