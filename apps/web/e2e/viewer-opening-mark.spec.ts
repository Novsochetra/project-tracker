import type { Page } from '@playwright/test';
import { expect, isPhone, test } from './fixtures';
import { seedProject } from './helpers';

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

// In a build, the press on a tile starts the viewer part's stylesheet with its code, and WebKit
// draws nothing added while a stylesheet loads until it's in (PT-114). The dev server brings CSS
// in scripts, so a stylesheet held here stands in for the part's, beside its held code.
async function holdViewerPart(page: Page): Promise<() => void> {
  let release = () => undefined as void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  await page.route(/\/src\/features\/attachments\/viewers\.ts(\?.*)?$/, async (route) => {
    await gate;
    await route.continue();
  });
  await page.route('**/held-viewers.css', async (route) => {
    await gate;
    await route.fulfill({ contentType: 'text/css', body: '' });
  });
  await page.evaluate(() => {
    const sheet = document.createElement('link');
    sheet.rel = 'stylesheet';
    sheet.href = '/held-viewers.css';
    document.head.append(sheet);
  });
  return release;
}

// The animations of the tile's spinner, which WebKit starts once it styles it. Read without asking
// for a box or taking a screenshot, as WebKit styles everything at once for those.
const markAnimations = (page: Page) =>
  page.evaluate(() => {
    const label = [...document.querySelectorAll('[role="status"]')].find(
      (status) => status.textContent === 'Opening',
    );
    const mark = label?.closest('.quiet-in');
    return mark ? mark.getAnimations({ subtree: true }).length : -1;
  });

// A trace's DOM snapshots would style it too.
test.use({ trace: 'off' });

test("shows the tile spinner while the viewer part's stylesheet loads", async ({
  page,
  api,
}, info) => {
  await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Crash on rotate' }]);
  await api.uploadAttachment(new Blob([PNG_1X1], { type: 'image/png' }), 'shot.png', 'MOB-1');
  await page.goto('/p/MOB/1');
  const tile = page.getByRole('button', { name: 'Open image 1', exact: true });
  await expect(tile).toBeVisible();
  const release = await holdViewerPart(page);
  await (isPhone(info.project.name) ? tile.tap() : tile.click());
  await expect.poll(() => markAnimations(page)).toBeGreaterThan(0);
  release();
  await expect(page.getByRole('dialog', { name: 'Image viewer' })).toBeVisible();
  await expect.poll(() => markAnimations(page)).toBe(-1);
});
