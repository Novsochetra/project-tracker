import { CLICK_SHIELD_MS } from '../../lib/clickShield';

// A menu's delete confirm takes no clicks right after it appears (MenuConfirm), so a test waits
// like a person reading it before pressing one of its buttons.
export const readMenuConfirm = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, CLICK_SHIELD_MS));
