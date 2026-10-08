import { CLICK_SHIELD_MS, isAimedClick, isShielded } from '../../lib/clickShield';

const PRESSES = ['mousedown', 'click'] as const;

// The screen or sheet the element is in: the page's root, or an overlay's on the body.
function layerOf(element: Element): Element {
  let layer = element;
  while (layer.parentElement && layer.parentElement !== element.ownerDocument.body) {
    layer = layer.parentElement;
  }
  return layer;
}

// When a note goes, what lay below it moves up into its place, or on a screen scrolled to its end
// what lay above it moves down, so either can land under the finger: a file's x, the Add tile or
// Comment. For CLICK_SHIELD_MS its screen or sheet drops the presses that may not be aimed at what
// is there now, the second tap of a double tap among them: a touch or pen tap and a double-click's
// later clicks. A mouse's single click and a key press go through, as on an action sheet (PT-82),
// and preventing the mousedown leaves focus where it was.
export function holdPresses(within: Element): void {
  const layer = layerOf(within);
  const heldAt = performance.now();
  // Not every browser's click says which pointer made it, so the pointerdown before it tells.
  let pointerType: string | null = null;
  const inLayer = (event: Event) => event.target instanceof Node && layer.contains(event.target);
  const see = (event: PointerEvent) => {
    if (inLayer(event)) pointerType = event.pointerType;
  };
  const drop = (event: MouseEvent) => {
    if (!inLayer(event)) return;
    const aimed = isAimedClick(pointerType, event.detail);
    if (event.type === 'click') pointerType = null;
    if (aimed || !isShielded(event.detail, heldAt, performance.now())) return;
    event.preventDefault();
    event.stopPropagation();
  };
  document.addEventListener('pointerdown', see, true);
  PRESSES.forEach((type) => document.addEventListener(type, drop, true));
  setTimeout(() => {
    document.removeEventListener('pointerdown', see, true);
    PRESSES.forEach((type) => document.removeEventListener(type, drop, true));
  }, CLICK_SHIELD_MS);
}
