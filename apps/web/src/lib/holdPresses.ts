import { CLICK_SHIELD_MS, isAimedClick, isShielded } from './clickShield';
import { followPresses } from './pressPointer';

const PRESSES = ['mousedown', 'click'] as const;

// The screen or sheet the element is in: the page's root, or an overlay's on the body.
function layerOf(element: Element): Element {
  let layer = element;
  while (layer.parentElement && layer.parentElement !== element.ownerDocument.body) {
    layer = layer.parentElement;
  }
  return layer;
}

// The fixed or sticky bar of the layer that is on top at this point, if any.
function barAt(x: number, y: number, layer: Element): Element | null {
  for (let found = document.elementFromPoint(x, y); found && found !== layer;) {
    const { position } = getComputedStyle(found);
    if (position === 'fixed' || position === 'sticky') return layer.contains(found) ? found : null;
    found = found.parentElement;
  }
  return null;
}

// A screen's bars along the top and bottom, such as its nav bar and bottom bar, with where they
// are now. A sheet has none: one that fits its content shrinks with the note, so its header moves
// too, and the scrim it uncovers would close it. A page without layout (jsdom) can't tell.
function stillBars(note: Element, layer: Element): Map<Element, DOMRect> {
  const bars = new Map<Element, DOMRect>();
  if (typeof document.elementFromPoint !== 'function' || note.closest('[role="dialog"]')) {
    return bars;
  }
  for (const y of [0, window.innerHeight - 1]) {
    const bar = barAt(window.innerWidth / 2, y, layer);
    if (bar && !bar.contains(note)) bars.set(bar, bar.getBoundingClientRect());
  }
  return bars;
}

const sameBox = (a: DOMRect, b: DOMRect): boolean =>
  a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;

// When a note goes, what lay below it moves up into its place, or on a screen scrolled to its end
// what lay above it moves down, so either can land under the finger: a file's x, the Add tile or
// Comment. For CLICK_SHIELD_MS its screen or sheet drops the presses that may not be aimed at what
// is there now, the second tap of a double tap among them: a touch or pen tap and a double-click's
// later clicks. A mouse's single click and a key press go through, as on an action sheet (PT-82),
// and preventing the mousedown leaves focus where it was. So do presses on a screen's bars while
// they stay where they were (PT-101): nothing moves under the finger there.
export function holdPresses(within: Element): void {
  const layer = layerOf(within);
  const bars = stillBars(within, layer);
  const heldAt = performance.now();
  const presses = followPresses();
  const inLayer = (event: Event) => event.target instanceof Node && layer.contains(event.target);
  const onStillBar = ({ target }: Event) =>
    target instanceof Node &&
    [...bars].some(
      ([bar, box]) => bar.contains(target) && sameBox(box, bar.getBoundingClientRect()),
    );
  const see = (event: PointerEvent) => {
    if (inLayer(event)) presses.press(event.pointerType, layer);
  };
  const drop = (event: MouseEvent) => {
    if (!inLayer(event)) return;
    const aimed = isAimedClick(presses.pointer(), event.detail);
    if (event.type === 'click') presses.forget();
    if (aimed || !isShielded(event.detail, heldAt, performance.now()) || onStillBar(event)) return;
    event.preventDefault();
    event.stopPropagation();
  };
  document.addEventListener('pointerdown', see, true);
  PRESSES.forEach((type) => document.addEventListener(type, drop, true));
  setTimeout(() => {
    presses.stop();
    document.removeEventListener('pointerdown', see, true);
    PRESSES.forEach((type) => document.removeEventListener(type, drop, true));
  }, CLICK_SHIELD_MS);
}
