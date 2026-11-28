import { appearanceChoice, subscribeAppearanceChoice } from './appearanceSetting';
import { crossFade } from './crossFade';
import { DARK_SCHEME_QUERY, resolveAppearance } from './resolveAppearance';
import { applyAppearance } from './themeMeta';

// Once, from the page's entry: index.html set the appearance before the first paint; this keeps
// it in step with the Account choice and with the system's own switch (at sunset, say).
export function startAppearance(window: Window): () => void {
  const { document } = window;
  const system =
    typeof window.matchMedia === 'function' ? window.matchMedia(DARK_SCHEME_QUERY) : null;
  const current = () => resolveAppearance(appearanceChoice(), system?.matches ?? false);

  applyAppearance(document, current());

  const update = () => {
    const next = current();
    if (document.documentElement.dataset.appearance === next) return;

    crossFade(document, () => applyAppearance(document, next));
  };

  system?.addEventListener('change', update);
  const unsubscribe = subscribeAppearanceChoice(update);

  return () => {
    system?.removeEventListener('change', update);
    unsubscribe();
  };
}
