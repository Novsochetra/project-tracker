import type { Locator, Page } from '@playwright/test';
import { expect, isPhone, test } from './fixtures';

const NAMES: Record<string, string> = {
  NA: 'Marketing website redesign',
  NB: 'Marketing website redesign for the 2026 launch and new brand',
};

async function box(locator: Locator) {
  const rect = await locator.boundingBox();
  expect(rect).not.toBeNull();

  return rect!;
}

const apart = (left: { x: number; width: number }, right: { x: number; width: number }) =>
  left.x + left.width <= right.x + 0.5 || right.x + right.width <= left.x + 0.5;

async function hits(page: Page, target: Locator, x: number, y: number) {
  const handle = await target.elementHandle();

  return page.evaluate(
    ([el, px, py]) => {
      const at = document.elementFromPoint(px, py);

      return at !== null && (el as Element).contains(at);
    },
    [handle, x, y] as const,
  );
}

test.describe('phone nav bar with a long project name', () => {
  // Measured mid-entry, the sliding back button can graze the title by a pixel or two.
  test.use({ reducedMotion: 'reduce' });

  for (const width of [320, 375]) {
    for (const [key, name] of Object.entries(NAMES)) {
      test(`${name.length} chars at ${width}px: back and ••• stay clear of the title`, async ({
        page,
        api,
      }, info) => {
        test.skip(!isPhone(info.project.name), 'The nav bar is phone only');
        await api.createProject({ name, key });
        await page.setViewportSize({ width, height: 812 });
        await page.goto(`/p/${key}`);
        const bar = page.locator(`[data-stack-path="/p/${key}"] header[data-navbar]`);
        const title = bar.getByText(name, { exact: true });
        await expect(title).toBeVisible();
        const titleBox = await box(title);
        for (const label of ['Back to Projects', 'Project options']) {
          const button = bar.getByRole('button', { name: label });
          const buttonBox = await box(button);
          expect(buttonBox.width, label).toBeGreaterThanOrEqual(43.5);
          expect(buttonBox.height, label).toBeGreaterThanOrEqual(43.5);
          expect(buttonBox.x + buttonBox.width, label).toBeLessThanOrEqual(width);
          expect(apart(titleBox, buttonBox), `${label} vs title`).toBe(true);
          expect(
            await hits(page, button, buttonBox.x + 12, buttonBox.y + buttonBox.height / 2),
            label,
          ).toBe(true);
        }

        if (name.length > 40) {
          expect(await title.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
        }
      });
    }
  }
});
