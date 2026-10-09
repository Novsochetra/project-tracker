// What says the person moved on from a file they opened while its viewer's code was on its way, so
// the viewer doesn't open late over what they did since and take its focus (PT-107). A press counts
// as well as a focus, as a tap on iOS focuses no button, and so does a key in a field that kept
// focus through the tap. Text put in a field counts too, as dictation types no keys. A press, a
// wheel or a key starts every scroll the person makes; scrolls the app makes don't count.
const ON_DOCUMENT = ['pointerdown', 'keydown', 'focusin', 'wheel', 'input'] as const;

export function watchMovingOn(drop: () => void): () => void {
  const onEvent = (event: Event) => {
    // The Escape that drops it is used up, as an overlay's is, so a sheet under the tile stays.
    if (event instanceof KeyboardEvent && event.key === 'Escape') event.preventDefault();
    drop();
  };
  const onVisibility = () => {
    if (document.visibilityState === 'hidden') drop();
  };
  // Capturing, so a control that stops an event from bubbling can't hide it.
  for (const type of ON_DOCUMENT) {
    document.addEventListener(type, onEvent, { capture: true, passive: type !== 'keydown' });
  }
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('popstate', drop);
  return () => {
    for (const type of ON_DOCUMENT) document.removeEventListener(type, onEvent, { capture: true });
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('popstate', drop);
  };
}
