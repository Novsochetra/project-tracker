import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Dialog, Locator, Page, Response } from '@playwright/test';
import { FILE_NAME_HEADER } from '@tracker/shared';
import { CLICK_SHIELD_MS } from '../src/lib/clickShield';
import { expect, isPhone, test } from './fixtures';
import { openNewTicketIn, seedProject, ticketRow, toast } from './helpers';
import { API_URL } from './ports';

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);
// 1.5 s of H.264 at 96x64, the codec iPhones and Safari play.
const CLIP = readFileSync(join(import.meta.dirname, 'files/clip.mp4'));
const STEPS = 'Steps to reproduce:\n1. Open Profile\n2. Rotate the phone twice\n';

const newTicketSheet = (page: Page) => page.getByRole('dialog', { name: 'New ticket' });

const isRangedFileAnswer = (response: Response): boolean =>
  /\/api\/attachments\/[^/]+\/file$/.test(new URL(response.url()).pathname) &&
  response.request().headers().range !== undefined;

const crashLogs = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    name: `crash-report-${index + 1}.log`,
    mimeType: 'text/plain',
    buffer: Buffer.from('boom\n'),
  }));

const PHONE = { width: 375, height: 812 };
const SMALL_PHONE = { width: 320, height: 568 };
// As wide as a desktop, with touch.
const TABLET = { width: 820, height: 1180 };

const NEW_TICKET_SHEETS = [
  {
    name: 'New ticket',
    open: async (page: Page) => {
      await page.goto('/p/MOB');
      await openNewTicketIn(page, 'To do');
    },
  },
  {
    name: 'quick capture',
    open: async (page: Page) => {
      await page.goto('/');
      await expect(page.getByRole('button', { name: /^Mobile app/ }).last()).toBeVisible();
      await page.locator('[data-bottom-bar]').getByRole('button', { name: 'New ticket' }).click();
    },
  },
];

const images = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    name: `shot-${index + 1}.png`,
    mimeType: 'image/png',
    buffer: PNG_1X1,
  }));

const DRAFT_FILE_AREAS = [
  ...NEW_TICKET_SHEETS.map((surface) => ({
    ...surface,
    area: newTicketSheet,
    input: 'Add files to ticket',
  })),
  {
    name: 'the comment box',
    open: async (page: Page) => {
      await page.goto('/p/MOB/1');
    },
    area: (page: Page) =>
      page.locator('form').filter({ has: page.getByLabel('Comment', { exact: true }) }),
    input: 'Attach files to comment',
  },
];

const FILE_AREAS = [
  ...DRAFT_FILE_AREAS,
  {
    name: 'the ticket screen',
    open: async (page: Page) => {
      await page.goto('/p/MOB/1');
    },
    area: (page: Page) => page.locator('body'),
    input: 'Add files to ticket',
  },
];

const SVG = { name: 'notes.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') };

interface BannerSaid {
  bannerSaid: boolean;
}

// Whether the page ever said the tracker can't be reached: its banner announces that.
const recordBanner = () => {
  const said: BannerSaid = { bannerSaid: false };
  Object.assign(window, said);
  new MutationObserver(() => {
    const regions = [...document.querySelectorAll('[aria-live]')];
    if (regions.some((region) => region.textContent?.includes("Can't reach the tracker"))) {
      Object.assign(window, { bannerSaid: true } satisfies BannerSaid);
    }
  }).observe(document, { subtree: true, childList: true, characterData: true });
};

// late.png's upload fails 2.5 s on, with a bare 500 like a proxy's; the others go through.
const failLate = (page: Page) =>
  page.route('**/api/attachments*', async (route) => {
    if (route.request().headers()[FILE_NAME_HEADER] !== 'late.png') return route.continue();
    await new Promise((resolve) => setTimeout(resolve, 2500));
    return route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
  });

const spotOf = async (locator: Locator) => {
  const box = (await locator.boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

// Seen: its middle is on the screen and nothing, such as a sheet's header or the bottom bar,
// covers it.
const isSeen = (element: Element) => {
  const box = element.getBoundingClientRect();
  const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
  return hit !== null && element.contains(hit);
};

// The name of the control a tap at the spot would press, if any.
const controlAt = (page: Page, spot: { x: number; y: number }) =>
  page.evaluate(({ x, y }) => {
    const control = document.elementFromPoint(x, y)?.closest('button, textarea, input, a');
    return control ? (control.getAttribute('aria-label') ?? control.textContent) : null;
  }, spot);

interface TapClicks {
  tapClicks: number[];
}

// The page's clock at each click, from its first load on.
const recordClicks = () => {
  const clicks: number[] = [];
  Object.assign(window, { tapClicks: clicks } satisfies TapClicks);
  window.addEventListener('click', () => clicks.push(performance.now()), true);
};

// Picks a refused file, then taps its note's Dismiss twice, `gap` ms apart. Playwright's tap
// returns once the page has handled it, so a page busy for a moment sends the second tap later
// than that, past the hold, where it rightly acts: `held` tells whether it came in time, by the
// page's clock.
async function doubleTapDismiss(page: Page, input: Locator, note: Locator, gap: number) {
  await input.setInputFiles([SVG]);
  const dismiss = note.getByRole('button', { name: 'Dismiss' });
  // Centred once it has risen into place: centred on the way, it ends up to 6px higher, and on a
  // slow first load at 320 the spot then missed the Comment that slides under it (PT-95 review).
  await note.evaluate((element) =>
    Promise.all(element.getAnimations().map((animation) => animation.finished)),
  );
  // Clear of the phone's bottom bar, which covers the end of the screen.
  await dismiss.evaluate((button) => button.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(400);
  const spot = await spotOf(dismiss);
  await page.evaluate(() => {
    (window as unknown as TapClicks).tapClicks.length = 0;
  });
  await page.touchscreen.tap(spot.x, spot.y);
  await page.waitForTimeout(gap);
  await page.touchscreen.tap(spot.x, spot.y);
  await page.waitForTimeout(700);
  const [first, second] = await page.evaluate(() => (window as unknown as TapClicks).tapClicks);
  const held = first !== undefined && second !== undefined && second - first < CLICK_SHIELD_MS;
  return { spot, held };
}

async function swipeDown(page: Page): Promise<void> {
  const { width, height } = page.viewportSize() ?? { width: 375, height: 812 };
  await page.mouse.move(width / 2, height / 2);
  await page.mouse.down();
  for (let step = 1; step <= 8; step += 1) {
    await page.mouse.move(width / 2, height / 2 + step * 40);
  }
  await page.mouse.up();
}

test.describe('attachments', () => {
  test('phone: a new ticket takes a photo, a text file and a video, and the ticket shows and opens each', async ({
    page,
    api,
  }, info) => {
    test.skip(!isPhone(info.project.name), 'The phone flow; desktop drags a file below.');
    await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Existing ticket' }]);
    await page.goto('/p/MOB');
    await openNewTicketIn(page, 'To do');
    const sheet = newTicketSheet(page);
    await sheet.getByLabel('Ticket title').fill('Crash on rotate');
    await expect(sheet.getByRole('button', { name: 'Add files' })).toBeVisible();
    await sheet.getByLabel('Add files to ticket').setInputFiles([
      { name: 'shot.png', mimeType: 'image/png', buffer: PNG_1X1 },
      { name: 'steps.txt', mimeType: 'text/plain', buffer: Buffer.from(STEPS) },
      { name: 'clip.mp4', mimeType: 'video/mp4', buffer: CLIP },
    ]);
    await expect(sheet.getByRole('img', { name: 'Image 1' })).toBeVisible();
    await expect(sheet.getByRole('img', { name: 'Video 1' })).toBeVisible();
    await expect(sheet.getByText('steps.txt')).toBeVisible();
    await expect(sheet.getByRole('progressbar')).toHaveCount(0);
    await sheet.getByRole('button', { name: 'Create' }).click();
    await expect(toast(page, 'MOB-2 created')).toBeVisible();
    const created = await api.getTicket('MOB-2');
    // In the order they were picked, whichever finished first.
    expect(created.attachments.map((file) => file.mimeType)).toEqual([
      'image/png',
      'text/plain',
      'video/mp4',
    ]);
    const clip = created.attachments.find((file) => file.mimeType === 'video/mp4');

    const ranged: Response[] = [];
    page.on('response', (response) => {
      if (isRangedFileAnswer(response)) ranged.push(response);
    });
    await ticketRow(page, 'MOB-2').click();
    await expect(page).toHaveURL(/\/p\/MOB\/2$/);
    await expect(page.getByRole('button', { name: 'Open image 1' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Play video 1' })).toBeVisible();

    await page.getByRole('button', { name: 'Open steps.txt' }).click();
    const preview = page.getByRole('dialog', { name: 'steps.txt' });
    await expect(preview.getByText('2. Rotate the phone twice')).toBeVisible();
    await preview.getByRole('button', { name: 'Close' }).click();
    await expect(preview).toBeHidden();

    await page.getByRole('button', { name: 'Play video 1' }).click();
    const viewer = page.getByRole('dialog', { name: 'Video viewer' });
    const video = viewer.locator('video');
    await expect(video).toHaveAttribute('src', clip?.url ?? '');
    await expect(video).toHaveAttribute('playsinline', '');
    await expect(video).toHaveAttribute('controls', '');
    // Headless WebKit may not decode the video, but it asks for it in ranges, which iOS needs.
    await expect.poll(() => ranged.map((response) => response.status())).toContain(206);
    expect(
      ranged.find((response) => response.status() === 206)?.headers()['content-range'],
    ).toMatch(new RegExp(`^bytes \\d+-\\d+/${CLIP.length}$`));
    await swipeDown(page);
    await expect(viewer).toBeHidden();
  });

  test('files keep the order they were picked, though the first one finishes last', async ({
    page,
    api,
  }) => {
    await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Existing ticket' }]);
    await page.goto('/p/MOB');
    await openNewTicketIn(page, 'To do');
    const sheet = newTicketSheet(page);
    await sheet.getByLabel('Ticket title').fill('Five logs');
    const names = ['a', 'b', 'c', 'd', 'e'].map((letter) => `${letter}.log`);
    const uploadOf = (name: string) => (response: Response) =>
      response.url().endsWith('/api/attachments') &&
      response.request().headers()[FILE_NAME_HEADER] === name;
    let releaseFirst: () => void = () => undefined;
    const firstHeld = new Promise<void>((resolve) => (releaseFirst = resolve));
    await page.route('**/api/attachments', async (route) => {
      if (route.request().headers()[FILE_NAME_HEADER] === names[0]) await firstHeld;
      await route.continue();
    });
    const othersDone = Promise.all(
      names.slice(1).map((name) => page.waitForResponse(uploadOf(name))),
    );
    const tileNames = () =>
      sheet
        .locator('[title$=".log"]')
        .evaluateAll((tiles) => tiles.map((tile) => tile.getAttribute('title')));

    await sheet
      .getByLabel('Add files to ticket')
      .setInputFiles(
        names.map((name) => ({ name, mimeType: 'text/plain', buffer: Buffer.from(`${name}\n`) })),
      );
    await othersDone;
    expect(await tileNames()).toEqual(names);
    releaseFirst();
    await expect(sheet.getByRole('progressbar')).toHaveCount(0);
    expect(await tileNames()).toEqual(names);
    await sheet.getByRole('button', { name: 'Create' }).click();
    await expect(toast(page, 'MOB-2 created')).toBeVisible();
    const created = await api.getTicket('MOB-2');
    expect(created.attachments.map((file) => file.fileName)).toEqual(names);
  });

  test('phone: a refused file and a 21st file are said in the picker area until dismissed', async ({
    page,
    api,
  }, info) => {
    test.skip(!isPhone(info.project.name), 'The note replaces a toast too short for a phone.');
    await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Existing ticket' }]);
    await page.goto('/p/MOB');
    await openNewTicketIn(page, 'To do');
    const sheet = newTicketSheet(page);
    const svg = { name: 'notes.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') };
    await sheet.getByLabel('Add files to ticket').setInputFiles([svg]);
    const note = sheet.getByRole('alert');
    await expect(note).toContainText("notes.svg can't be attached.");
    await expect(note).toContainText('text files (TXT, LOG, MD, CSV, JSON) and PDFs');
    const box = await note.boundingBox();
    expect((box?.x ?? -1) >= 0 && (box?.x ?? 0) + (box?.width ?? 0) <= 375).toBe(true);
    await page.waitForTimeout(3_000);
    await expect(note).toBeVisible();
    await note.getByRole('button', { name: 'Dismiss' }).tap();
    await expect(note).toBeHidden();
    // The sheet takes no taps for a moment while what was under the note settles.
    await page.waitForTimeout(500);

    const logs = Array.from({ length: 21 }, (_, index) => ({
      name: `crash-report-${index + 1}.log`,
      mimeType: 'text/plain',
      buffer: Buffer.from('boom\n'),
    }));
    await sheet.getByLabel('Add files to ticket').setInputFiles(logs);
    await expect(note).toContainText("crash-report-21.log can't be attached.");
    await expect(note).toContainText('A new ticket can have up to 20 files.');
    await expect(sheet.getByRole('progressbar')).toHaveCount(0);
    await expect(sheet.locator('[title^="crash-report-"]')).toHaveCount(20);
    await sheet.getByLabel('Ticket title').fill('Twenty logs');
    await sheet.getByRole('button', { name: 'Create' }).click();
    await expect(toast(page, 'MOB-2 created')).toBeVisible();
    expect((await api.getTicket('MOB-2')).attachments).toHaveLength(20);
  });

  for (const surface of NEW_TICKET_SHEETS) {
    test(`small phone: a file left out of a big pick in ${surface.name} is said in view`, async ({
      page,
      api,
    }, info) => {
      test.skip(!isPhone(info.project.name), 'The fold of a 320×568 phone.');
      await page.setViewportSize(SMALL_PHONE);
      await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Existing ticket' }]);
      await surface.open(page);
      const sheet = newTicketSheet(page);
      const input = sheet.getByLabel('Add files to ticket');
      const note = sheet.getByRole('alert');

      await input.setInputFiles(crashLogs(21));
      await expect(note).toContainText("crash-report-21.log can't be attached.");
      await expect(note).toBeInViewport({ ratio: 1 });
      // Shown where Add files was, without moving the sheet.
      await expect(sheet.getByLabel('Ticket title')).toBeInViewport();
      await expect(sheet.getByRole('progressbar')).toHaveCount(0);

      // From the Add tile under 19 files the top of the file area is out of sight.
      await note.getByRole('button', { name: 'Dismiss' }).tap();
      await expect(note).toBeHidden();
      // The sheet takes no taps for a moment while what was under the note settles.
      await page.waitForTimeout(500);
      await sheet.getByRole('button', { name: 'Remove crash-report-20.log' }).tap();
      const addTile = sheet.locator('[data-add-tile]');
      await addTile.scrollIntoViewIfNeeded();
      await expect(sheet.getByLabel('Ticket title')).not.toBeInViewport();
      await input.setInputFiles(crashLogs(3));
      await expect(note).toContainText("crash-report-2.log and 1 more can't be attached.");
      await expect(note).toBeInViewport({ ratio: 1 });
    });
  }

  // Quick capture opens from the phone's bottom bar, which a tablet doesn't have.
  for (const [surface, size] of DRAFT_FILE_AREAS.flatMap((area) =>
    [PHONE, SMALL_PHONE, ...(area.name === 'quick capture' ? [] : [TABLET])].map(
      (viewport) => [area, viewport] as const,
    ),
  )) {
    test(`touch ${size.width}: a double tap on a file's x in ${surface.name} removes one file`, async ({
      page,
      api,
    }, info) => {
      test.skip(!isPhone(info.project.name), 'A double tap on a touch screen; clicks are below.');
      await page.setViewportSize(size);
      await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Existing ticket' }]);
      await surface.open(page);
      const area = surface.area(page);
      await area.getByLabel(surface.input).setInputFiles(images(3));
      await expect(area.getByRole('progressbar')).toHaveCount(0);
      const removes = area.getByRole('button', { name: /^Remove image/ });
      await expect(removes).toHaveCount(3);
      await removes.first().scrollIntoViewIfNeeded();
      const box = (await removes.first().boundingBox())!;
      const spot = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      const underSpot = () =>
        page.evaluate(
          ({ x, y }) =>
            document.elementFromPoint(x, y)?.closest('button')?.getAttribute('aria-label'),
          spot,
        );

      await page.touchscreen.tap(spot.x, spot.y);
      await page.waitForTimeout(150);
      await expect(removes).toHaveCount(2);
      // The next image has slid under the finger and is now image 1.
      expect(await underSpot()).toBe('Remove image 1');
      await page.touchscreen.tap(spot.x, spot.y);
      await page.waitForTimeout(600);
      await expect(removes).toHaveCount(2);

      await page.touchscreen.tap(spot.x, spot.y);
      await expect(removes).toHaveCount(1);
    });
  }

  test("desktop: a double-click on a file's x removes one file", async ({ page, api }, info) => {
    test.skip(isPhone(info.project.name), 'Touch screens are above.');
    await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Existing ticket' }]);
    await page.goto('/p/MOB');
    await openNewTicketIn(page, 'To do');
    const sheet = newTicketSheet(page);
    await sheet.getByLabel('Add files to ticket').setInputFiles(images(3));
    await expect(sheet.getByRole('progressbar')).toHaveCount(0);
    const removes = sheet.getByRole('button', { name: /^Remove image/ });
    await removes.first().dblclick();
    await page.waitForTimeout(600);
    await expect(removes).toHaveCount(2);
    await removes.first().click();
    await expect(removes).toHaveCount(1);
  });

  // Each where the bug shows: what lay under the note slides under the finger as it goes. Two
  // can't show it. The comment box ends the ticket screen, which at 375×812 is scrolled to its end
  // with the note in view, so the files above slide down instead, and no file's x reaches the
  // Dismiss spot at 375; nor does one at 320 on the ticket screen, three tiles to a row.
  const cantShow = (area: string, viewport: typeof PHONE) =>
    (area === 'the comment box' && viewport === PHONE) ||
    (area === 'the ticket screen' && viewport === SMALL_PHONE);
  for (const [surface, size] of FILE_AREAS.flatMap((area) =>
    [PHONE, SMALL_PHONE]
      .filter((viewport) => !cantShow(area.name, viewport))
      .map((viewport) => [area, viewport] as const),
  )) {
    test(`phone ${size.width}: a double tap on the note's Dismiss in ${surface.name} only dismisses it`, async ({
      page,
      api,
      request,
    }, info) => {
      test.skip(!isPhone(info.project.name), 'A double tap on a phone.');
      await page.setViewportSize(size);
      await page.addInitScript(recordClicks);
      const area = surface.area(page);
      const input = area.getByLabel(surface.input);
      const removes = area.getByRole('button', { name: /^Remove image/ });
      const note = area.getByRole('alert').filter({ hasText: "can't be attached" });
      let chooser = 0;
      page.on('filechooser', () => (chooser += 1));
      const setUp = async () => {
        await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Existing ticket' }]);
        await surface.open(page);
        await input.setInputFiles(images(8));
        await expect(area.getByRole('progressbar')).toHaveCount(0);
        await expect(removes).toHaveCount(8);
        // The photo picker closes the keyboard, so no field has focus when the note comes.
        await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
      };
      // After a second tap that came too late, and may have acted, from a clean tracker.
      const startOver = async () => {
        await page.evaluate(() => localStorage.clear());
        expect((await request.post(`${API_URL}/api/test/reset`)).status()).toBe(204);
        chooser = 0;
        // Leaving a sheet with files asks first; the ticket screen doesn't, and a listener left
        // behind would pile up with each try.
        const leave = (dialog: Dialog) => void dialog.accept();
        page.on('dialog', leave);
        await setUp();
        page.off('dialog', leave);
      };
      await setUp();

      for (const gap of [0, 60, 120, 200]) {
        let tapped = await doubleTapDismiss(page, input, note, gap);
        for (let tries = 1; !tapped.held && tries < 3; tries += 1) {
          await startOver();
          tapped = await doubleTapDismiss(page, input, note, gap);
        }
        expect(tapped.held, `the second tap within ${CLICK_SHIELD_MS} ms, in 3 tries`).toBe(true);
        await expect(note).toHaveCount(0);
        // Nothing that slid under the finger took the second tap: no file removed or asked about,
        // no comment sent (it would take the files along), no file picker, no field focused for
        // the keyboard.
        await expect(removes).toHaveCount(8);
        await expect(page.getByRole('dialog', { name: /^Remove/ })).toHaveCount(0);
        expect(chooser).toBe(0);
        expect(await page.evaluate(() => document.activeElement?.matches('textarea, input'))).toBe(
          false,
        );
        // Though there was something to press: a file's x or Comment, slid up from below, or in
        // a sheet that fits the screen, a field slid down from above as the sheet shrank.
        expect(await controlAt(page, tapped.spot)).toMatch(
          /^(Remove image \d|Comment|Description|Ticket title)$/,
        );
      }
    });
  }

  for (const size of [PHONE, SMALL_PHONE]) {
    test(`phone ${size.width}: a tap aimed at a file's x just after Dismiss on the ticket screen acts on that file`, async ({
      page,
      api,
    }, info) => {
      test.skip(!isPhone(info.project.name), 'A tap on a phone.');
      await page.setViewportSize(size);
      await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Existing ticket' }]);
      await page.goto('/p/MOB/1');
      await page.getByLabel('Add files to ticket').setInputFiles([...images(8), SVG]);
      await expect(page.getByRole('progressbar')).toHaveCount(0);
      const dismiss = page.getByRole('alert').getByRole('button', { name: 'Dismiss' });
      await dismiss.evaluate((button) => button.scrollIntoView({ block: 'center' }));
      await page.waitForTimeout(400);
      const firstX = page.getByRole('button', { name: 'Remove image 1' });
      const before = await spotOf(firstX);

      const spot = await spotOf(dismiss);
      await page.touchscreen.tap(spot.x, spot.y);
      await page.waitForTimeout(250);
      // Where image 1's x shows a moment after the tap: where a person aims for it.
      const aimed = await spotOf(firstX);
      await page.waitForTimeout(350);
      await page.touchscreen.tap(aimed.x, aimed.y);
      await expect(page.getByRole('dialog', { name: /^Remove/ })).toContainText('Remove image 1?');
      // The files moved up into the note's place with the tap, and not again later.
      const settled = await spotOf(firstX);
      expect(before.y - settled.y).toBeGreaterThan(40);
      expect(Math.abs(settled.y - aimed.y)).toBeLessThan(1);
    });
  }

  // The nav bar and the bottom bar stay where they are when a note goes, so a tap on them just
  // after Dismiss is aimed and acts; before PT-101 the whole screen held it for 500 ms.
  for (const [bar, done] of [
    ['Back to Mobile app', (page: Page) => expect(page).toHaveURL(/\/p\/MOB$/)],
    [
      'Paste report',
      (page: Page) => expect(page.getByRole('dialog', { name: /report/i })).toBeVisible(),
    ],
  ] as const) {
    test(`phone: a tap on ${bar} just after Dismiss on the ticket screen acts`, async ({
      page,
      api,
    }, info) => {
      test.skip(!isPhone(info.project.name), 'A tap on a phone.');
      await page.addInitScript(recordClicks);
      await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Existing ticket' }]);
      await page.goto('/p/MOB/1');
      await page.getByLabel('Add files to ticket').setInputFiles([...images(8), SVG]);
      await expect(page.getByRole('progressbar')).toHaveCount(0);
      const dismiss = page.getByRole('alert').getByRole('button', { name: 'Dismiss' });
      await dismiss.evaluate((button) => button.scrollIntoView({ block: 'center' }));
      await page.waitForTimeout(400);
      const spot = await spotOf(dismiss);
      const target = await spotOf(page.getByRole('button', { name: bar }));
      await page.evaluate(() => {
        (window as unknown as TapClicks).tapClicks.length = 0;
      });

      await page.touchscreen.tap(spot.x, spot.y);
      await page.waitForTimeout(150);
      await page.touchscreen.tap(target.x, target.y);

      await done(page);
      const [first, second] = await page.evaluate(() => (window as unknown as TapClicks).tapClicks);
      expect(second! - first!, 'the tap came while the screen held others').toBeLessThan(
        CLICK_SHIELD_MS,
      );
    });
  }

  // Where a person may be when an upload fails: at the Add tile they picked from, at the bottom
  // of the screen, or back in the middle of the files.
  const LATE_SCROLLS = [
    { name: 'the Add tile', scroll: (area: Locator) => area.locator('[data-add-tile]') },
    {
      name: 'mid-grid',
      scroll: (area: Locator) => area.getByRole('button', { name: 'Remove image 8' }),
    },
  ];
  for (const [surface, where] of FILE_AREAS.filter(
    (area) => area.name !== 'the comment box',
  ).flatMap((area) => LATE_SCROLLS.map((scroll) => [area, scroll] as const))) {
    test(`small phone: an upload that fails late in ${surface.name}, scrolled to ${where.name}, is seen without moving the files`, async ({
      page,
      api,
    }, info) => {
      test.skip(!isPhone(info.project.name), 'The fold of a 320×568 phone.');
      await page.setViewportSize(SMALL_PHONE);
      await page.addInitScript(recordBanner);
      await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Existing ticket' }]);
      await failLate(page);
      await surface.open(page);
      const area = surface.area(page);
      await area
        .getByLabel(surface.input)
        .setInputFiles([...images(15), { ...images(1)[0]!, name: 'late.png' }]);
      await expect(area.getByRole('progressbar')).toHaveCount(1);
      await where.scroll(area).evaluate((element) => element.scrollIntoView({ block: 'center' }));
      await page.waitForTimeout(300);
      const tile = area.getByRole('button', { name: 'Remove image 10' });
      const lateX = area.getByRole('button', { name: 'Remove late.png' });
      const before = { tile: (await tile.boundingBox())!.y, late: (await lateX.boundingBox())!.y };

      const failed = area.getByRole('img', { name: "late.png didn't upload" });
      await expect(failed).toBeAttached({ timeout: 8000 });
      await page.waitForTimeout(300);
      // Its tile stays where it was and says so: nothing on screen moves.
      expect(Math.abs((await tile.boundingBox())!.y - before.tile)).toBeLessThan(1);
      expect(Math.abs((await lateX.boundingBox())!.y - before.late)).toBeLessThan(1);
      // The note that says why is below the files; out of sight, a toast says it too.
      const note = area.getByRole('alert').filter({ hasText: "late.png didn't upload." });
      const told = page.getByRole('status').getByText("late.png didn't upload.", { exact: true });
      const noteSeen = await note.evaluate(isSeen);
      await expect(told).toHaveCount(noteSeen ? 0 : 1);
      if (!noteSeen) await expect(told).toBeInViewport();
      // One file's 500 says nothing about the tracker, which answers its check: no banner says,
      // even for a moment, that the whole tracker can't be reached (PT-101).
      expect(await page.evaluate(() => (window as unknown as BannerSaid).bannerSaid)).toBe(false);
    });
  }

  // The comment box keeps no failed tile, and its note is below the files by Attach files: from
  // its first files at 320×568 that is out of sight, so a toast says it (PT-101).
  test('small phone: an upload that fails late in the comment box, scrolled to its first files, is said in a toast', async ({
    page,
    api,
  }, info) => {
    test.skip(!isPhone(info.project.name), 'The fold of a 320×568 phone.');
    await page.setViewportSize(SMALL_PHONE);
    await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Existing ticket' }]);
    await failLate(page);
    const commentBox = DRAFT_FILE_AREAS.find((area) => area.name === 'the comment box')!;
    await commentBox.open(page);
    const area = commentBox.area(page);
    await area
      .getByLabel(commentBox.input)
      .setInputFiles([...images(15), { ...images(1)[0]!, name: 'late.png' }]);
    await expect(area.getByRole('progressbar')).toHaveCount(1);
    await area
      .getByRole('button', { name: 'Remove image 1', exact: true })
      .evaluate((element) => element.scrollIntoView({ block: 'center' }));

    const note = area.getByRole('alert').filter({ hasText: "late.png didn't upload." });
    await expect(note).toBeAttached({ timeout: 8000 });
    await page.waitForTimeout(300);
    expect(await note.evaluate(isSeen)).toBe(false);
    const told = page.getByRole('status').getByText("late.png didn't upload.", { exact: true });
    await expect(told).toBeInViewport();
  });

  test('desktop: a file dropped on the New ticket sheet is attached', async ({
    page,
    api,
  }, info) => {
    test.skip(isPhone(info.project.name), 'Files are dragged on desktop.');
    await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Existing ticket' }]);
    await page.goto('/p/MOB');
    await openNewTicketIn(page, 'To do');
    const sheet = newTicketSheet(page);
    await sheet.getByLabel('Ticket title').fill('Dropped notes');
    const dataTransfer = await page.evaluateHandle(() => {
      const data = new DataTransfer();
      data.items.add(new File(['# Notes\nFrom the desktop'], 'notes.md', { type: '' }));
      return data;
    });
    const description = sheet.getByLabel('Description', { exact: true });
    await description.dispatchEvent('dragenter', { dataTransfer });
    await expect(sheet.getByText('Drop files to attach')).toBeVisible();
    await description.dispatchEvent('dragover', { dataTransfer });
    await description.dispatchEvent('drop', { dataTransfer });
    await expect(sheet.getByText('Drop files to attach')).toBeHidden();
    await expect(sheet.getByText('notes.md')).toBeVisible();
    await expect(sheet.getByRole('progressbar')).toHaveCount(0);

    await sheet.getByRole('button', { name: 'Create' }).click();
    await expect(toast(page, 'MOB-2 created')).toBeVisible();
    const created = await api.getTicket('MOB-2');
    expect(created.attachments.map((file) => [file.fileName, file.mimeType])).toEqual([
      ['notes.md', 'text/markdown'],
    ]);
  });
});
