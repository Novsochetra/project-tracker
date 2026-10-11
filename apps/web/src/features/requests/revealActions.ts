import { prefersReducedMotionNow } from '../../lib/media';
import { visibleTop } from '../../navigation/visibleTop';
import { scrollParent } from '../steps/followEnd';

const GAP = 8;
// The keyboard opens after the focus, and shrinks what is seen once more.
const KEYBOARD_WAIT_MS = 1000;
const COVERS = '[data-bottom-cover], [data-bottom-bar]';

// The bottom of the screen is covered by the chat's footer or a bar, and by the keyboard, which
// only the visual viewport's bottom knows of. What is taller than the room left keeps its top in
// sight, where a card says what Claude asks.
export function revealDistance(
  bottom: number,
  visibleBottom: number,
  coverTops: number[],
  roomAbove = Infinity,
) {
  const limit = Math.min(visibleBottom, ...coverTops) - GAP;
  return Math.max(0, Math.min(Math.ceil(bottom - limit), Math.floor(roomAbove)));
}

const visibleBottom = (): number => {
  const viewport = window.visualViewport;
  return viewport ? viewport.offsetTop + viewport.height : window.innerHeight;
};

function reveal(target: HTMLElement): void {
  const scroller = scrollParent(target);
  if (!scroller) return;
  const tops = [...document.querySelectorAll(COVERS)].map(
    (cover) => cover.getBoundingClientRect().top,
  );
  const box = target.getBoundingClientRect();
  const roomAbove = box.top - visibleTop(scroller) - GAP;
  const distance = revealDistance(box.bottom, visibleBottom(), tops, roomAbove);
  if (distance <= 0) return;
  const behavior = prefersReducedMotionNow() ? 'instant' : 'smooth';
  scroller.scrollTo({ top: scroller.scrollTop + distance, behavior });
}

// Measured a frame later, once a screen that just opened has its layout.
export const revealInSight = (target: HTMLElement): void =>
  void requestAnimationFrame(() => reveal(target));

// Typing an answer in the last question put Send answer under the chat's footer, and under the
// keyboard on a phone, so the buttons come into sight when the box takes focus and once the
// keyboard is up.
export function revealActions(buttons: HTMLElement | null): void {
  if (!buttons) return;
  revealInSight(buttons);
  const viewport = window.visualViewport;
  if (!viewport) return;
  const onResize = () => reveal(buttons);
  viewport.addEventListener('resize', onResize);
  setTimeout(() => viewport.removeEventListener('resize', onResize), KEYBOARD_WAIT_MS);
}
