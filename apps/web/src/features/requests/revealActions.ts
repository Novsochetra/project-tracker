import { prefersReducedMotionNow } from '../../lib/media';
import { scrollParent } from '../steps/followEnd';

const GAP = 8;
// The keyboard opens after the focus, and shrinks what is seen once more.
const KEYBOARD_WAIT_MS = 1000;
const COVERS = '[data-bottom-cover], [data-bottom-bar]';

// The bottom of the screen is covered by the chat's footer or a bar, and by the keyboard, which
// only the visual viewport's bottom knows of.
export function revealDistance(buttonsBottom: number, visibleBottom: number, coverTops: number[]) {
  const limit = Math.min(visibleBottom, ...coverTops) - GAP;
  return Math.max(0, Math.ceil(buttonsBottom - limit));
}

const visibleBottom = (): number => {
  const viewport = window.visualViewport;
  return viewport ? viewport.offsetTop + viewport.height : window.innerHeight;
};

function reveal(buttons: HTMLElement): void {
  const scroller = scrollParent(buttons);
  if (!scroller) return;
  const tops = [...document.querySelectorAll(COVERS)].map(
    (cover) => cover.getBoundingClientRect().top,
  );
  const distance = revealDistance(buttons.getBoundingClientRect().bottom, visibleBottom(), tops);
  if (distance <= 0) return;
  const behavior = prefersReducedMotionNow() ? 'instant' : 'smooth';
  scroller.scrollTo({ top: scroller.scrollTop + distance, behavior });
}

// Typing an answer in the last question put Send answer under the chat's footer, and under the
// keyboard on a phone, so the buttons come into sight when the box takes focus and once the
// keyboard is up.
export function revealActions(buttons: HTMLElement | null): void {
  if (!buttons) return;
  requestAnimationFrame(() => reveal(buttons));
  const viewport = window.visualViewport;
  if (!viewport) return;
  const onResize = () => reveal(buttons);
  viewport.addEventListener('resize', onResize);
  setTimeout(() => viewport.removeEventListener('resize', onResize), KEYBOARD_WAIT_MS);
}
