import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page, Response } from '@playwright/test';
import { FILE_NAME_HEADER } from '@tracker/shared';
import { expect, isPhone, test } from './fixtures';
import { openNewTicketIn, seedProject, ticketRow, toast } from './helpers';

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
