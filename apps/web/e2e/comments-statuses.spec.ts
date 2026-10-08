import { expect, isPhone, test } from './fixtures';
import { activity, group, readActionSheet, readMenuConfirm, seedProject } from './helpers';

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

test.describe('comments', () => {
  test('adds, edits and deletes a comment', async ({ page, api }) => {
    await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Login error' }]);
    await page.goto('/p/MOB/1');
    const composer = page.getByLabel('Comment', { exact: true });
    const send = page.getByRole('button', { name: 'Comment', exact: true });
    await expect(send).toBeDisabled();
    await composer.fill('First thought');
    await send.click();
    await expect(composer).toHaveValue('');
    await expect(activity(page)).toContainText('First thought');

    await page.getByRole('button', { name: 'Comment options' }).first().click();
    await readActionSheet(page);
    await page.getByRole('button', { name: 'Edit comment' }).click();
    const editor = page.getByLabel('Edit comment', { exact: true });
    await editor.fill('Second thought');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(activity(page)).toContainText('Second thought');
    await expect(activity(page)).toContainText('edited');

    await page.getByRole('button', { name: 'Comment options' }).first().click();
    await readActionSheet(page);
    await page.getByRole('button', { name: 'Delete comment' }).click();
    await readMenuConfirm(page);
    await page.getByRole('button', { name: 'Delete', exact: true }).last().click();
    await expect(activity(page)).not.toContainText('Second thought');
  });

  // The menu opens above a button near the bottom of the screen, and its delete confirm grows
  // upward from there, which puts the confirm's Delete button where Delete comment was.
  test('a double-click on Delete comment in a menu above its button keeps the confirm', async ({
    page,
    api,
  }, info) => {
    test.skip(isPhone(info.project.name), 'Phones show an action sheet');
    await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Login error' }]);
    for (let n = 1; n <= 10; n += 1) await api.addComment('MOB-1', { text: `Thought ${n}` });
    await page.goto('/p/MOB/1');
    const options = page.getByRole('button', { name: 'Comment options' }).last();
    // Placed while the cards still rise, the button would settle lower, partly off the screen.
    await expect
      .poll(() => activity(page).evaluate((log) => log.getAnimations({ subtree: true }).length))
      .toBe(0);
    await options.evaluate((button) => {
      let scroller = button.parentElement;
      const scrolls = (element: HTMLElement) =>
        element.scrollHeight > element.clientHeight &&
        /auto|scroll/.test(getComputedStyle(element).overflowY);
      while (scroller && !scrolls(scroller)) scroller = scroller.parentElement;
      (scroller ?? document.scrollingElement!).scrollTop +=
        button.getBoundingClientRect().bottom - (window.innerHeight - 40);
    });
    await options.click();
    const menu = await page.getByRole('group', { name: 'Comment options' }).boundingBox();
    const button = await options.boundingBox();
    expect(menu!.y + menu!.height).toBeLessThanOrEqual(button!.y);
    const item = (await page.getByRole('button', { name: 'Delete comment' }).boundingBox())!;
    const spot = { x: item.x + item.width - 30, y: item.y + item.height / 2 };
    const underSpot = () =>
      page.evaluate(
        ({ x, y }) => document.elementFromPoint(x, y)?.closest('button')?.textContent,
        spot,
      );

    await page.mouse.click(spot.x, spot.y);
    await page.waitForTimeout(150);
    expect(await underSpot()).toBe('Delete');
    await page.mouse.click(spot.x, spot.y);

    await page.waitForTimeout(600);
    await expect(page.getByRole('alert')).toContainText(
      "Delete this comment? This can't be undone.",
    );
    await expect(activity(page)).toContainText('Thought 10');
    await page.mouse.click(spot.x, spot.y);
    await expect(activity(page)).not.toContainText('Thought 10');
  });

  // On phones the sheet's confirm puts its Delete row where Delete comment was.
  test('a double tap on Delete comment in the action sheet keeps the confirm', async ({
    page,
    api,
  }, info) => {
    test.skip(!isPhone(info.project.name), 'Desktop shows a menu');
    await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Login error' }]);
    await api.addComment('MOB-1', { text: 'First thought' });
    await page.goto('/p/MOB/1');
    await page.getByRole('button', { name: 'Comment options' }).click();
    await readActionSheet(page);
    const item = (await page.getByRole('button', { name: 'Delete comment' }).boundingBox())!;
    const spot = { x: item.x + item.width / 2, y: item.y + item.height / 2 };
    const underSpot = () =>
      page.evaluate(
        ({ x, y }) => document.elementFromPoint(x, y)?.closest('button')?.textContent,
        spot,
      );

    await page.touchscreen.tap(spot.x, spot.y);
    await page.waitForTimeout(150);
    expect(await underSpot()).toBe('Delete');
    await page.touchscreen.tap(spot.x, spot.y);

    await page.waitForTimeout(600);
    const sheet = page.getByRole('dialog', { name: 'Comment options' });
    await expect(sheet).toContainText("Delete this comment? This can't be undone.");
    await expect(activity(page)).toContainText('First thought');
    await page.touchscreen.tap(spot.x, spot.y);
    await expect(activity(page)).not.toContainText('First thought');
  });

  test('a double-click on Edit comment leaves the editor open', async ({ page, api }, info) => {
    test.skip(isPhone(info.project.name), 'Phones show an action sheet');
    await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Login error' }]);
    await page.goto('/p/MOB/1');
    await page.getByLabel('Comment', { exact: true }).fill('First thought');
    await page.getByRole('button', { name: 'Comment', exact: true }).click();
    await page.getByRole('button', { name: 'Comment options' }).first().click();
    await page.getByRole('button', { name: 'Edit comment' }).dblclick();
    const editor = page.getByLabel('Edit comment', { exact: true });
    await expect(editor).toBeFocused();
    await page.waitForTimeout(600);
    await expect(editor).toBeVisible();
    await expect(editor).toHaveValue('First thought');
  });

  test('attaches an image to a comment and opens the viewer', async ({ page, api }) => {
    await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Screenshot bug' }]);
    await page.goto('/p/MOB/1');
    await page.getByLabel('Attach files to comment').setInputFiles({
      name: 'shot.png',
      mimeType: 'image/png',
      buffer: PNG_1X1,
    });
    await page.getByRole('button', { name: 'Comment', exact: true }).click();
    const thumb = activity(page)
      .getByRole('button', { name: /Open image/ })
      .first();
    await expect(thumb).toBeVisible();
    await thumb.click();
    await expect(page.getByRole('dialog', { name: /Image/ })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: /Image/ })).toBeHidden();
  });
});

test.describe('statuses', () => {
  test('adds, renames and removes a custom status', async ({ page, api }) => {
    await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Waiting on design' }]);
    await page.goto('/p/MOB');
    await page.getByRole('button', { name: 'Project options' }).first().click();
    await readActionSheet(page);
    await page.getByRole('button', { name: 'Manage statuses' }).click();
    const sheet = page.getByRole('dialog', { name: 'Statuses' });
    await expect(sheet).toBeVisible();
    for (const name of ['To do', 'In progress', 'Need review', 'Reviewed', 'Done']) {
      await expect(sheet.getByText(name, { exact: true })).toBeVisible();
    }
    await sheet.getByRole('button', { name: 'Add status' }).click();
    await sheet.getByLabel('Status name').fill('Blocked');
    await sheet.getByRole('button', { name: 'Save status' }).click();
    await expect(sheet.getByText('Blocked', { exact: true })).toBeVisible();
    await sheet.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(sheet).toBeHidden();

    const { statuses } = await api.getProject('MOB');
    expect(statuses.map((status) => status.name)).toContain('Blocked');
    await expect(group(page, 'Blocked')).toHaveCount(0);
  });
});
