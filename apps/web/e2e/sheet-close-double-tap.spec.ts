import type { Page } from '@playwright/test';
import { doubleTap, doubleTapViewports } from './doubleTap';
import { expect, isPhone, test } from './fixtures';
import { seedProject } from './helpers';

interface LandedClicks {
  landedClicks: string[];
}

// holdPresses stops a held click on its way down, so counting the clicks that reach the window
// tells a held second tap from one that landed, whatever it landed on.
const recordLandedClicks = () => {
  const landed: string[] = [];
  Object.assign(window, { landedClicks: landed } satisfies LandedClicks);
  window.addEventListener('click', (event) => {
    landed.push(event.target instanceof Element ? event.target.outerHTML.slice(0, 80) : '');
  });
};

const resetLandedClicks = (page: Page): Promise<void> =>
  page.evaluate(() => {
    (window as unknown as LandedClicks).landedClicks.length = 0;
  });

const landedClicks = (page: Page): Promise<string[]> =>
  page.evaluate(() => (window as unknown as LandedClicks).landedClicks);

const LONG = 'Steps to reproduce, what happened and what should happen instead. '.repeat(10);

const sendButton = (projectName: string) =>
  isPhone(projectName) ? 'Send to Claude' : 'Send to Claude Code';

// Under the prompt sheet's Close lie the ticket's description, whose field opens the keyboard, or
// its main, by the screen's size. The bars it covered are held too (holdPresses.test).
test("a double tap on a sheet's Close leaves the screen behind it alone", async ({
  page,
  api,
}, info) => {
  const cases = doubleTapViewports(info.project.name).flatMap((viewport) =>
    [LONG, 'Rotate twice.'].map((description) => ({ viewport, description })),
  );
  await seedProject(
    api,
    'Mobile app',
    'MOB',
    cases.map(({ description }) => ({ title: 'Crash when rotating', description })),
  );
  await page.addInitScript(recordLandedClicks);
  const dialog = page.getByRole('dialog', { name: 'Send to Claude Code' });
  const close = dialog.getByRole('button', { name: 'Close' });

  for (const [index, { viewport }] of cases.entries()) {
    const path = `/p/MOB/${index + 1}`;
    await page.setViewportSize(viewport);
    await page.goto(path);
    await page.getByRole('button', { name: sendButton(info.project.name), exact: true }).click();
    await expect(close).toBeVisible();
    await resetLandedClicks(page);
    await doubleTap(page, close, Boolean(info.project.use.hasTouch));
    await page.waitForTimeout(300);

    await expect(dialog).toBeHidden();
    expect(await landedClicks(page), 'only the click on Close').toHaveLength(1);
    await expect(page).toHaveURL(path);
    expect(await page.evaluate(() => document.activeElement?.tagName)).not.toMatch(
      /TEXTAREA|INPUT/,
    );
  }
});

// An action sheet's Cancel lies over the project screen's bottom bar, whose buttons open sheets.
test("a double tap on an action sheet's Cancel leaves the screen behind it alone", async ({
  page,
  api,
}, info) => {
  test.skip(!isPhone(info.project.name), 'Project options is a menu on desktop.');
  await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Crash when rotating' }]);
  await page.addInitScript(recordLandedClicks);
  await page.goto('/p/MOB');
  await page.getByRole('button', { name: 'Project options' }).first().click();
  const sheet = page.getByRole('dialog', { name: 'Project options' });
  const cancel = sheet.getByRole('button', { name: 'Cancel' });
  await expect(cancel).toBeVisible();
  await resetLandedClicks(page);
  await doubleTap(page, cancel, true);
  await page.waitForTimeout(300);

  await expect(sheet).toBeHidden();
  expect(await landedClicks(page), 'only the click on Cancel').toHaveLength(1);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page).toHaveURL('/p/MOB');
});
