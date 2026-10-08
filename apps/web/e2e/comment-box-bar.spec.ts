import type { Locator, Page } from '@playwright/test';
import { expect, isPhone, test } from './fixtures';
import { activity, seedProject, settled } from './helpers';

// The phone bottom bar slides away while a text field has focus. It came back over the comment
// box's Comment button: mid-tap (the release landed on "Send to Claude") and when the keyboard
// closed with the box at the bottom of the screen. Keeping the edited field above the bar then
// scrolled a long description to its end, pulled back a scroll made right after the keyboard
// closed, and missed a comment sent after the keyboard had closed.

// About as long as PT-48's 1,013 characters, which run past the room between the nav bar and the
// bar at 375×812.
const LONG_DESCRIPTION = Array.from(
  { length: 14 },
  (_, line) =>
    `Step ${line + 1}: open the ticket, change a word in its description, close the keyboard.`,
).join('\n');
const ROOM_AT_375 = 812 - 53 - 69 - 8;

const screenOf = (page: Page) => page.locator('[data-stack-path="/p/MOB/1"]');
const bar = (page: Page) => screenOf(page).locator('[data-bottom-bar]');
const scroller = (page: Page) => screenOf(page).locator('[data-stack-scroller]');
const commentField = (page: Page) => page.getByLabel('Comment', { exact: true });
const commentButton = (page: Page) => page.getByRole('button', { name: 'Comment', exact: true });
const HOLD_ENTRANCE =
  '[data-bottom-bar] { animation-delay: -170ms !important; animation-play-state: paused !important; }';

async function openTicket(page: Page, api: Parameters<typeof seedProject>[0]) {
  await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Login error' }]);
  await page.goto('/p/MOB/1');
  await expect(commentButton(page)).toBeDisabled();
}

async function settle(page: Page) {
  await settled(screenOf(page));
  await scroller(page).evaluate(async (element) => {
    const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
    let last = Number.NaN;
    while (element.scrollTop !== last) {
      last = element.scrollTop;
      await frame();
      await frame();
    }
  });
}

// Where the box sat when the E2E failed: its bottom on the screen's bottom edge, under the bar.
async function boxAtScreenBottom(page: Page) {
  await settle(page);
  await scroller(page).evaluate((element) => {
    const box = element.querySelector('textarea[aria-label="Comment"]')!.closest('form')!;
    element.scrollTop +=
      box.getBoundingClientRect().bottom - element.getBoundingClientRect().bottom;
  });
}

async function typeComment(page: Page, text: string) {
  await commentField(page).fill(text);
  await expect(bar(page)).toHaveAttribute('data-hidden');
  await settle(page);
}

const hitAtCenter = (target: Locator) =>
  target.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    return hit !== null && element.contains(hit);
  });

const scrollTop = (page: Page) => scroller(page).evaluate((element) => element.scrollTop);

const gapAboveBar = (page: Page) =>
  commentField(page).evaluate((field) => {
    const bar = document.querySelector('[data-bottom-bar]')!.getBoundingClientRect();
    return bar.top - field.closest('form')!.getBoundingClientRect().bottom;
  });

const PHONE_ONLY = 'The bottom bar is phone only';

test.describe('phone bottom bar and the comment box', () => {
  test('closing the keyboard leaves the comment box and its Comment button uncovered', async ({
    page,
    api,
  }, info) => {
    test.skip(!isPhone(info.project.name), PHONE_ONLY);
    await openTicket(page, api);
    await boxAtScreenBottom(page);
    await typeComment(page, 'Kept in sight');

    await commentField(page).blur();
    await expect(bar(page)).not.toHaveAttribute('data-hidden');
    await settle(page);
    expect(await hitAtCenter(commentButton(page))).toBe(true);
    expect(await hitAtCenter(commentField(page))).toBe(true);
    await commentButton(page).click();
    await expect(activity(page)).toContainText('Kept in sight');
  });

  test('a slow tap on Comment sends the comment while the bar waits', async ({
    page,
    api,
  }, info) => {
    test.skip(!isPhone(info.project.name), PHONE_ONLY);
    await openTicket(page, api);
    await boxAtScreenBottom(page);
    await typeComment(page, 'A slow tap');

    const box = (await commentButton(page).boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    // A press long enough for a bar coming back on mousedown to slide over the button.
    await page.waitForTimeout(250);
    await page.mouse.up();
    await expect(commentField(page)).toHaveValue('');
    await expect(activity(page)).toContainText('A slow tap');

    await settle(page);
    expect(await hitAtCenter(commentButton(page))).toBe(true);
  });

  test('a field focused while the bar is still sliding in sends it away', async ({
    page,
    api,
  }, info) => {
    test.skip(!isPhone(info.project.name), PHONE_ONLY);
    // Freezes the bar halfway through its entrance, as if the field got focus while it came in.
    await page.addInitScript((css) => {
      document.addEventListener('DOMContentLoaded', () => {
        const style = document.createElement('style');
        style.textContent = css;
        document.head.append(style);
      });
    }, HOLD_ENTRANCE);
    await openTicket(page, api);
    await commentField(page).fill('Typed early');
    await expect(bar(page)).toHaveAttribute('data-hidden');
    await expect
      .poll(() => bar(page).evaluate((element) => element.getBoundingClientRect().top))
      .toBeGreaterThanOrEqual(812);
  });

  test('closing the keyboard after editing a long description leaves the screen where it is', async ({
    page,
    api,
  }, info) => {
    test.skip(!isPhone(info.project.name), PHONE_ONLY);
    await seedProject(api, 'Mobile app', 'MOB', [
      { title: 'Login error', description: LONG_DESCRIPTION },
    ]);
    await page.goto('/p/MOB/1');
    const description = page.getByLabel('Description', { exact: true });
    await expect(description).toHaveValue(LONG_DESCRIPTION);
    await settle(page);
    // Phones fold a long description until it is edited (PT-73): the tap edits it and opens it.
    const folded = (await description.boundingBox())!;
    await page.touchscreen.tap(folded.x + 24, folded.y + 12);
    await page.keyboard.type('x');
    await expect(bar(page)).toHaveAttribute('data-hidden');
    await settle(page);
    const box = (await description.boundingBox())!;
    expect(box.height, 'taller than the room above the bar').toBeGreaterThan(ROOM_AT_375);
    const editing = await scrollTop(page);
    await description.blur();
    await expect(bar(page)).not.toHaveAttribute('data-hidden');
    await settle(page);
    expect(await scrollTop(page)).toBe(editing);
    expect(await hitAtCenter(page.getByLabel('Title', { exact: true }))).toBe(true);
  });

  test('a comment sent after the keyboard closed leaves the empty box above the bar', async ({
    page,
    api,
  }, info) => {
    test.skip(!isPhone(info.project.name), PHONE_ONLY);
    await openTicket(page, api);
    await boxAtScreenBottom(page);
    await typeComment(page, 'Sent after the keyboard closed');
    await commentField(page).blur();
    await expect(bar(page)).not.toHaveAttribute('data-hidden');
    await settle(page);

    await commentButton(page).tap();
    await expect(activity(page)).toContainText('Sent after the keyboard closed');
    await expect(commentField(page)).toHaveValue('');
    await settle(page);
    expect(await gapAboveBar(page)).toBeGreaterThanOrEqual(8);
    expect(await hitAtCenter(commentButton(page))).toBe(true);
    expect(await hitAtCenter(commentField(page))).toBe(true);
  });

  test('a scroll right after the keyboard closes stays where it was left', async ({
    page,
    api,
  }, info) => {
    test.skip(!isPhone(info.project.name), PHONE_ONLY);
    await openTicket(page, api);
    await boxAtScreenBottom(page);
    await typeComment(page, 'Scrolled away');
    await commentField(page).blur();
    await page.waitForTimeout(120);
    // Mobile WebKit has no wheel, and Playwright no touch drag.
    const left = await scroller(page).evaluate((element) => {
      element.scrollBy({ top: -200 });
      return element.scrollTop;
    });
    await settle(page);
    expect(await scrollTop(page)).toBe(left);
  });
});
