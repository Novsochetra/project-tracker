import type { Locator, Page } from '@playwright/test';
import { toYmd } from '@tracker/shared';
import { expect, isPhone, test, usesPhoneLayout } from './fixtures';
import { activity, seedProject, settled, toast } from './helpers';

// PT-73: on a phone the Details card sat in the middle of the ticket, under the description and
// the files, and with long comments the comment box was screens away. The details are now chips
// under the title, long text folds, and a pill jumps to the comment box.

const PHONE_ONLY = 'The phone layout';
const LONG_TITLE =
  'Phone ticket screen: Details should stay at the top instead of the middle, long comments need folding';
const LONG_STATUS = 'Waiting on design review from the team';
const LONG_NAME = 'Claude (worker 55, the very long assignee name)';
const NAME = 'Claude (lead)';
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);
// About as long as PT-61's comments (500 to 1,900 characters).
const LONG_COMMENT = (n: number) =>
  `Decisions (worker ${n}): the calendar shows with a mouse on a window 768px or wider. `.repeat(
    12,
  );

const screenOf = (page: Page) => page.locator('[data-stack-path="/p/MOB/1"]');
const bar = (page: Page) => screenOf(page).locator('[data-bottom-bar]');
const scroller = (page: Page) => screenOf(page).locator('[data-stack-scroller]');
const chips = (page: Page) => page.getByRole('group', { name: 'Details' });
const jump = (page: Page) => page.getByRole('button', { name: 'Go to the comment box' });
const commentField = (page: Page) => page.getByLabel('Comment', { exact: true });

const daysFromToday = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return toYmd(date);
};

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

async function scrollTo(page: Page, top: number) {
  await scroller(page).evaluate((element, to) => element.scrollTo({ top: to }), top);
}

async function noSidewaysScroll(page: Page) {
  const [scrollWidth, clientWidth] = await scroller(page).evaluate((element) => [
    element.scrollWidth,
    element.clientWidth,
  ]);
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
}

// The size of a button's label and where its line of text sits.
const textLine = (button: Locator) =>
  button.evaluate((element) => {
    const label = [...element.childNodes].find((node) => node.nodeType === Node.TEXT_NODE)!;
    const range = document.createRange();
    range.selectNodeContents(label);
    return {
      fontSize: getComputedStyle(element).fontSize,
      bottom: range.getBoundingClientRect().bottom,
    };
  });

test.describe('ticket screen on a phone', () => {
  test('shows the details as chips under the title that fit 320px and change each field', async ({
    page,
    api,
  }, info) => {
    test.skip(!isPhone(info.project.name), PHONE_ONLY);
    await seedProject(api, 'Mobile app', 'MOB', [
      {
        title: LONG_TITLE,
        assignee: LONG_NAME,
        due: daysFromToday(-2),
        description: 'Rotate twice.',
      },
    ]);
    await api.createStatus('MOB', { name: LONG_STATUS, category: 'in_progress', color: '#C26A06' });
    for (const size of [
      { width: 320, height: 568 },
      { width: 375, height: 812 },
    ]) {
      await page.setViewportSize(size);
      await page.goto('/p/MOB/1');
      await expect(chips(page)).toBeInViewport();
      for (const chip of await chips(page).locator(':scope > *').all()) {
        const box = (await chip.boundingBox())!;
        expect(box.x + box.width, `${size.width}px`).toBeLessThanOrEqual(size.width - 16);
      }
      await noSidewaysScroll(page);
    }

    const status = chips(page).getByRole('button', { name: /^Status/ });
    await status.click();
    await page.getByRole('option', { name: LONG_STATUS }).click();
    await expect(status).toContainText(LONG_STATUS);
    await expect(toast(page, `MOB-1 moved to ${LONG_STATUS}`)).toBeVisible();
    await noSidewaysScroll(page);

    await chips(page)
      .getByRole('button', { name: /^Priority/ })
      .click();
    await page.getByRole('option', { name: 'High' }).click();
    const assignee = chips(page).getByLabel('Assignee', { exact: true });
    await assignee.fill('Dara');
    await assignee.blur();
    await expect(chips(page).getByRole('button', { name: 'Clear due date' })).toBeVisible();
    await chips(page).getByRole('button', { name: 'Clear due date' }).click();
    await chips(page).getByLabel('Due date', { exact: true }).fill(daysFromToday(3));

    const log = activity(page);
    await expect(log).toContainText(`You changed status to ${LONG_STATUS}`);
    await expect(log).toContainText('You set priority to High');
    await expect(log).toContainText('You assigned the ticket to Dara');
    await expect(log).toContainText('You removed the due date');
    await expect(log).toContainText('You set the due date to');
    await expect(page.getByRole('complementary', { name: 'Ticket details' })).toHaveCount(0);
  });

  test('folds long comments and jumps to the comment box', async ({ page, api, agent }, info) => {
    test.skip(!isPhone(info.project.name), PHONE_ONLY);
    await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Date picker', description: 'Bad.' }]);
    for (let n = 1; n <= 8; n += 1) await agent.addComment('MOB-1', { text: LONG_COMMENT(n) });
    await page.goto('/p/MOB/1');
    await settle(page);
    // The first screen stays uncovered until the reader scrolls down a little.
    await expect(jump(page)).toHaveCount(0);
    await scrollTo(page, 300);
    await expect(jump(page)).toBeVisible();
    // PT-84: a tab standing on the bar's top edge, so no line passes between it and the bar.
    await settle(page);
    const tab = (await jump(page).boundingBox())!;
    const barTop = (await bar(page).boundingBox())!.y;
    expect(Math.abs(tab.y + tab.height - (barTop + 1))).toBeLessThanOrEqual(1);
    await scrollTo(page, 0);
    await settle(page);

    const first = activity(page).locator('article').first();
    await first.scrollIntoViewIfNeeded();
    const more = first.getByRole('button', { name: 'Show more' });
    const folded = (await first.boundingBox())!.height;
    await more.click();
    const less = first.getByRole('button', { name: 'Show less' });
    await expect(less).toHaveAttribute('aria-expanded', 'true');
    expect((await first.boundingBox())!.height).toBeGreaterThan(folded + 200);
    await less.scrollIntoViewIfNeeded();
    await settle(page);
    const before = (await less.boundingBox())!.y;
    await less.click();
    await settle(page);
    // The button stays under the finger while the text closes above it.
    const after = (await first.getByRole('button', { name: 'Show more' }).boundingBox())!.y;
    expect(Math.abs(after - before)).toBeLessThanOrEqual(2);

    await scrollTo(page, 0);
    await expect(jump(page)).toHaveCount(0);
    await scrollTo(page, 300);
    await expect(jump(page)).toBeVisible();
    await jump(page).tap();
    await expect(commentField(page)).toBeFocused();
    await expect(bar(page)).toHaveAttribute('data-hidden');
    await expect(jump(page)).toHaveCount(0);
    await settle(page);
    await expect(commentField(page)).toBeInViewport();

    await commentField(page).fill('Reached the box in one tap');
    await commentField(page).blur();
    await expect(bar(page)).not.toHaveAttribute('data-hidden');
    await settle(page);
    await expect(jump(page)).toHaveCount(0);
    await page.getByRole('button', { name: 'Comment', exact: true }).click();
    await expect(activity(page)).toContainText('Reached the box in one tap');
  });

  test('keeps the whole assignee name after an edit and places the caret where tapped', async ({
    page,
    api,
  }, info) => {
    test.skip(!isPhone(info.project.name), PHONE_ONLY);
    await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Date picker', assignee: NAME }]);
    await page.goto('/p/MOB/1');
    const assignee = chips(page).getByLabel('Assignee', { exact: true });
    await assignee.tap();
    await expect(assignee).toBeFocused();
    await assignee.press('Enter');
    await expect(assignee).not.toBeFocused();
    // iOS Safari cut the field's own text ("Claude (le…"), so the chip shows a copy of the name.
    const shown = await assignee.evaluate((field) => {
      const name = field.nextElementSibling!;
      return {
        text: name.textContent,
        cut: name.scrollWidth > name.clientWidth,
        visible: getComputedStyle(name).visibility,
        fieldText: getComputedStyle(field).color,
      };
    });
    expect(shown).toEqual({
      text: NAME,
      cut: false,
      visible: 'visible',
      fieldText: 'rgba(0, 0, 0, 0)',
    });

    const box = (await assignee.boundingBox())!;
    await page.touchscreen.tap(box.x + 4, box.y + box.height / 2);
    await expect(assignee).toBeFocused();
    const caret = await assignee.evaluate((field: HTMLInputElement) => field.selectionStart);
    expect(caret).toBeLessThan(NAME.length);
  });

  test('folds many files to two rows with Show all', async ({ page, api }, info) => {
    test.skip(!isPhone(info.project.name), PHONE_ONLY);
    await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Screenshots' }]);
    for (let n = 1; n <= 12; n += 1) {
      await api.uploadAttachment(
        new Blob([PNG_1X1], { type: 'image/png' }),
        `shot-${n}.png`,
        'MOB-1',
      );
    }
    for (const size of [
      { width: 320, height: 568 },
      { width: 375, height: 812 },
    ]) {
      await page.setViewportSize(size);
      await page.goto('/p/MOB/1');
      const showAll = page.getByRole('button', { name: 'Show all 12 files' });
      await expect(showAll).toBeVisible();
      const files = page.locator(`[id="${await showAll.getAttribute('aria-controls')}"]`);
      const tiles = files.getByRole('button', { name: /^Open image/ });
      const firstRow = (await tiles.first().boundingBox())!.y;
      const box = (await files.boundingBox())!;
      // Two rows of 72px thumbnails, 24px apart, under the 24px left for the x buttons.
      expect(box.height, `${size.width}px`).toBeCloseTo(24 + 72 + 24 + 72, 0);
      expect(firstRow - box.y).toBeCloseTo(24, 0);
      const add = page.getByRole('button', { name: 'Add files', exact: true });
      await expect(add).toHaveText('Add files');
      // PT-84: one size and one baseline for the two buttons under the files.
      const [addText, showAllText] = [await textLine(add), await textLine(showAll)];
      expect(addText.fontSize, `${size.width}px`).toBe(showAllText.fontSize);
      expect(addText.bottom).toBeCloseTo(showAllText.bottom, 0);
      await noSidewaysScroll(page);
    }
    const showAll = page.getByRole('button', { name: 'Show all 12 files' });
    const files = page.locator(`[id="${await showAll.getAttribute('aria-controls')}"]`);
    await showAll.tap();
    await expect(page.getByRole('button', { name: 'Show less' })).toBeVisible();
    // Twelve files and the Add tile, four to a row.
    expect((await files.boundingBox())!.height).toBeCloseTo(24 + 4 * 72 + 3 * 24, 0);
    await expect(page.getByRole('button', { name: 'Add files', exact: true })).toHaveText('');
  });

  // PT-84: an iPhone turned sideways is wider than 768px and got the desktop layout with the
  // sidebar; a tablet keeps it.
  test('keeps the phone layout on a phone turned sideways', async ({ page, api }, info) => {
    test.skip(!isPhone(info.project.name), PHONE_ONLY);
    await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Date picker', assignee: NAME }]);
    await page.setViewportSize({ width: 844, height: 390 });
    await page.goto('/p/MOB/1');
    await expect(chips(page)).toBeVisible();
    await expect(bar(page)).toBeVisible();
    await expect(page.getByRole('complementary', { name: 'Projects' })).toHaveCount(0);
    await expect(page.getByRole('complementary', { name: 'Ticket details' })).toHaveCount(0);
    await noSidewaysScroll(page);

    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.getByRole('complementary', { name: 'Projects' })).toBeVisible();
    await expect(page.getByRole('complementary', { name: 'Ticket details' })).toBeVisible();
    await expect(chips(page)).toHaveCount(0);
  });

  test('desktop keeps the side panel and shows text whole', async ({ page, api, agent }) => {
    await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Date picker' }]);
    await agent.addComment('MOB-1', { text: LONG_COMMENT(1) });
    await page.goto('/p/MOB/1');
    test.skip(await usesPhoneLayout(page), 'Desktop is unchanged');
    await expect(page.getByRole('complementary', { name: 'Ticket details' })).toBeVisible();
    await expect(chips(page)).toHaveCount(0);
    await expect(activity(page)).toContainText('Decisions (worker 1)');
    await expect(page.getByRole('button', { name: 'Show more' })).toHaveCount(0);
    await expect(jump(page)).toHaveCount(0);
  });
});
