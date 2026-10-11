// The screen's sticky nav bar covers the top of what scrolls under it.
export function visibleTop(scroller: HTMLElement): number {
  const navBar = scroller.querySelector('[data-navbar]');
  return navBar ? navBar.getBoundingClientRect().bottom : scroller.getBoundingClientRect().top;
}
