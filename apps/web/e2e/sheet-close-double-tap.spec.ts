import { doubleTap, doubleTapViewports } from './doubleTap';
import { expect, isPhone, test } from './fixtures';
import { seedProject } from './helpers';

interface LandedClicks {
  landedClicks: string[];
}

// The clicks that reached the page's window, which a held one doesn't (holdPresses stops it on the
// way down): an init script (page.addInitScript).
const recordLandedClicks = () => {
  const landed: string[] = [];
  Object.assign(window, { landedClicks: landed } satisfies LandedClicks);
  window.addEventListener('click', (event) => {
    landed.push(event.target instanceof Element ? event.target.outerHTML.slice(0, 80) : '');
  });
};

const LONG = 'Steps to reproduce, what happened and what should happen instead. '.repeat(10);

const sendButton = (projectName: string) =>
  isPhone(projectName) ? 'Send to Claude' : 'Send to Claude Code';

// Under the prompt sheet's Close lie the nav bar's Back, the ticket's title or its description,
// by the screen's size (PT-148).
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
    await page.evaluate(() => {
      (window as unknown as LandedClicks).landedClicks.length = 0;
    });
    await doubleTap(page, close, Boolean(info.project.use.hasTouch));
    await page.waitForTimeout(300);

    await expect(dialog).toBeHidden();
    const landed = await page.evaluate(() => (window as unknown as LandedClicks).landedClicks);
    expect(landed, 'only the click on Close').toHaveLength(1);
    await expect(page).toHaveURL(path);
    expect(await page.evaluate(() => document.activeElement?.tagName)).not.toMatch(
      /TEXTAREA|INPUT/,
    );
  }
});
