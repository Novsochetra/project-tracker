import { CLICK_SHIELD_MS, isAimedClick, isShielded } from './clickShield';
import { followPresses } from './pressPointer';

const PRESSES = ['mousedown', 'click'] as const;

const holds = new Set<() => void>();

// The screen or sheet the element is in: the page's root, or an overlay's on the body.
function layerOf(element: Element): Element {
  let layer = element;
  while (layer.parentElement && layer.parentElement !== element.ownerDocument.body) {
    layer = layer.parentElement;
  }
  return layer;
}

const isPinned = (element: Element): boolean =>
  /^(fixed|sticky)$/.test(getComputedStyle(element).position);

const scrolls = (element: Element): boolean =>
  /^(auto|scroll)$/.test(getComputedStyle(element).overflowY);

function scrollerOf(note: Element, layer: Element): Element | null {
  for (let found = note.parentElement; found && found !== layer; found = found.parentElement) {
    if (scrolls(found)) return found;
  }
  return null;
}

// What is on top at this point and stays put while the note's place closes: a fixed or sticky
// bar, or the part of the page beside the scroller the note is in, which moves only with that
// scroller's box, as desktop's header and sidebar (PT-109).
function stillPartAt(x: number, y: number, scroller: Element | null): Element | null {
  let beside: Element | null = null;
  for (let found = document.elementFromPoint(x, y); found; found = found.parentElement) {
    if (isPinned(found)) return found;
    if (found === scroller) return null;
    if (scroller && found.contains(scroller)) return beside;
    beside = found;
  }
  return null;
}

// Along the top and the bottom, and on desktop the sidebar along the left.
const edges = (): [number, number][] => [
  [window.innerWidth / 2, 0],
  [window.innerWidth / 2, window.innerHeight - 1],
  [0, window.innerHeight / 2],
];

// A screen's bars and the parts of the page beside it, such as its nav bar and bottom bar or the
// desktop header and sidebar, with where they are now. A sheet has none: one that fits its
// content shrinks with the note, so its header moves too, and the scrim it uncovers would close
// it. Nor has the whole page, held as a sheet closes: the sheet covered its bars, and by then it
// may take no part in what is on top (inert). A page without layout (jsdom) can't tell.
function stillBars(note: Element, layer: Element): Map<Element, DOMRect> {
  const bars = new Map<Element, DOMRect>();
  const covered = note === note.ownerDocument.body || note.closest('[role="dialog"]');
  if (typeof document.elementFromPoint !== 'function' || covered) return bars;
  const scroller = scrollerOf(note, layer);
  for (const [x, y] of edges()) {
    const bar = stillPartAt(x, y, scroller);
    if (bar && layer.contains(bar) && !bar.contains(note)) {
      bars.set(bar, bar.getBoundingClientRect());
    }
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
// and preventing the mousedown leaves focus where it was. So do presses on a screen's bars
// (PT-101) and on desktop's header and sidebar (PT-109) while they stay where they were: nothing
// moves under the finger there.
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
    if (inLayer(event)) presses.press(event, layer);
  };
  const drop = (event: MouseEvent) => {
    if (!inLayer(event)) return;
    const aimed = isAimedClick(presses.pointer(), event.detail);
    if (event.type === 'click') presses.forget();
    if (aimed || !isShielded(event.detail, heldAt, performance.now()) || onStillBar(event)) return;
    event.preventDefault();
    event.stopPropagation();
  };
  const end = () => {
    clearTimeout(timer);
    holds.delete(end);
    presses.stop();
    document.removeEventListener('pointerdown', see, true);
    PRESSES.forEach((type) => document.removeEventListener(type, drop, true));
  };
  document.addEventListener('pointerdown', see, true);
  PRESSES.forEach((type) => document.addEventListener(type, drop, true));
  const timer = setTimeout(end, CLICK_SHIELD_MS);
  holds.add(end);
}

// Tests end every hold with the test: one whose time ran out after the test file's page had gone
// threw there (PT-167).
export function endHolds(): void {
  holds.forEach((end) => end());
}
