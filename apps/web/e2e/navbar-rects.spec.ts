import type { Locator, Page } from '@playwright/test';
import { expect, isPhone, test } from './fixtures';

const NAMES: Record<string, string> = {
  NA: 'Marketing website redesign',
  NB: 'Marketing website redesign for the 2026 launch and new brand',
};

async function box(locator: Locator) {
  const b = await locator.boundingBox();
  expect(b).not.toBeNull();
  return b!;
}

const apart = (a: { x: number; width: number }, b: { x: number; width: number }) =>
  a.x + a.width <= b.x + 0.5 || b.x + b.width <= a.x + 0.5;

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
  for (const width of [320, 375]) {
    for (const [key, name] of Object.entries(NAMES)) {
      test(`${name.length} chars at ${width}px: back, ••• and + stay clear of the title`, async ({
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
        const t = await box(title);
        for (const label of ['Back to Projects', 'Project options', 'New ticket']) {
          const button = bar.getByRole('button', { name: label });
          const b = await box(button);
          expect(b.width, label).toBeGreaterThanOrEqual(43.5);
          expect(b.height, label).toBeGreaterThanOrEqual(43.5);
          expect(b.x + b.width, label).toBeLessThanOrEqual(width);
          expect(apart(t, b), `${label} vs title`).toBe(true);
          expect(await hits(page, button, b.x + 12, b.y + b.height / 2), label).toBe(true);
        }
        if (name.length > 40) {
          expect(await title.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
        }
      });
    }
  }
});
