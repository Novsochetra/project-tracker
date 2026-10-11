import type { Locator, Page } from '@playwright/test';
import { isPhone } from './fixtures';
import { resting } from './helpers';

export const doubleTapViewports = (projectName: string) =>
  isPhone(projectName)
    ? [
        { width: 375, height: 812 },
        { width: 320, height: 568 },
      ]
    : [{ width: 1280, height: 800 }];

// A sheet slides up in script, and its buttons are visible from the start of the rise. Read on the
// way up, both taps went where the button had been and pressed nothing, 1 run in 3 (PT-157).
export async function doubleTap(page: Page, target: Locator, touch: boolean): Promise<void> {
  await resting(async () => (await target.boundingBox())?.y ?? Number.NaN);
  const box = await target.boundingBox();
  if (!box) throw new Error('Nothing to tap.');
  const [x, y] = [box.x + box.width / 2, box.y + box.height / 2];
  if (touch) {
    await page.touchscreen.tap(x, y);
    await page.waitForTimeout(150);
    await page.touchscreen.tap(x, y);
    return;
  }
  await page.mouse.click(x, y);
  await page.waitForTimeout(150);
  await page.mouse.down({ clickCount: 2 });
  await page.mouse.up({ clickCount: 2 });
}
