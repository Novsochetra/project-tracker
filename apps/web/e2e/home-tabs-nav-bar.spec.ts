import type { Page } from '@playwright/test';
import { expect, isPhone, test } from './fixtures';
import { seedProject } from './helpers';

// PT-254: a Projects/Activity switch mounts a new nav bar that is expanded under its large title,
// yet its small title ghosted in for about 5 frames and its bottom line faded out over about 8.
// Too short for Playwright's polling, so the page samples every frame itself.

interface Frame {
  path: string;
  smallTitle: number;
  line: number;
}

declare global {
  interface Window {
    navBarFrames: Frame[];
  }
}

const TITLES: Record<string, string> = { '/': 'Projects', '/activity': 'Activity' };

const sampleEveryFrame = (page: Page) =>
  page.evaluate((titles) => {
    window.navBarFrames = [];
    const alpha = (color: string) => {
      const parts = color.match(/[\d.]+/g) ?? [];
      if (parts.length >= 4) return Number(parts[3]);
      return color === 'transparent' ? 0 : 1;
    };
    const painted = (from: Element, to: Element) => {
      let opacity = 1;
      for (let el: Element | null = from; el && el !== to; el = el.parentElement) {
        opacity *= Number(getComputedStyle(el).opacity);
      }
      return opacity;
    };
    const sample = () => {
      for (const bar of document.querySelectorAll('[data-stack-path] header[data-navbar]')) {
        const path = bar.closest<HTMLElement>('[data-stack-path]')?.dataset.stackPath ?? '';
        const title = [...bar.querySelectorAll('span')].find((s) => s.textContent === titles[path]);
        window.navBarFrames.push({
          path,
          smallTitle: title ? painted(title, bar) : 0,
          line: alpha(getComputedStyle(bar).borderBottomColor),
        });
      }
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  }, TITLES);

const framesOf = (page: Page, path: string) =>
  page.evaluate((p) => window.navBarFrames.filter((f) => f.path === p), path);

async function switchTo(page: Page, name: string, path: string) {
  await page.evaluate(() => (window.navBarFrames = []));
  await page.getByRole('navigation', { name: 'Home' }).getByRole('button', { name }).click();
  await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible();
  // 20 frames is at least 330 ms, past the 160 ms fades of the nav bar.
  await expect.poll(async () => (await framesOf(page, path)).length).toBeGreaterThan(20);
  return framesOf(page, path);
}

test('a Projects/Activity switch shows no small title and no line under the nav bar', async ({
  page,
  api,
}, info) => {
  test.skip(!isPhone(info.project.name), 'The nav bar and the Home tabs are phone only');
  await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Crash' }]);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Projects', level: 1 })).toBeVisible();
  await sampleEveryFrame(page);
  // A first round loads the Activity screen's code, so the switches below are warm.
  await switchTo(page, 'Activity', '/activity');
  await switchTo(page, 'Projects', '/');

  for (const [name, path] of [
    ['Activity', '/activity'],
    ['Projects', '/'],
    ['Activity', '/activity'],
    ['Projects', '/'],
  ] as const) {
    const frames = await switchTo(page, name, path);
    expect(
      Math.max(...frames.map((f) => f.smallTitle)),
      `small title to ${name}`,
    ).toBeLessThanOrEqual(0.02);
    expect(Math.max(...frames.map((f) => f.line)), `line under the bar to ${name}`).toBe(0);
  }
});
