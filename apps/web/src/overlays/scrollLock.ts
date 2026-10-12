let locks = 0;
let saved: { scrollY: number; style: string | null } | null = null;

// iOS ignores overflow: hidden on body; pinning the body with position: fixed is what stops
// the page behind an overlay from scrolling.
function pinBody(): void {
  const { body } = document;
  const scrollY = window.scrollY;
  saved = { scrollY, style: body.getAttribute('style') };
  body.style.position = 'fixed';
  body.style.top = `-${scrollY}px`;
  body.style.left = '0';
  body.style.right = '0';
  body.style.overflow = 'hidden';
}

function unpinBody(): void {
  if (!saved) return;
  const { body } = document;
  if (saved.style === null) body.removeAttribute('style');
  else body.setAttribute('style', saved.style);
  if (saved.scrollY !== 0) window.scrollTo(0, saved.scrollY);
  saved = null;
}

export function lockBodyScroll(): () => void {
  if (locks === 0) pinBody();
  locks += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    locks -= 1;
    if (locks === 0) unpinBody();
  };
}

export const isBodyScrollLocked = (): boolean => locks > 0;
