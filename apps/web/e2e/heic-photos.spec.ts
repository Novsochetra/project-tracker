import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, isPhone, test } from './fixtures';
import { openNewTicketIn, seedProject, toast } from './helpers';

// A 64×48 HEIC, as iPhones save photos.
const HEIC = [...readFileSync(join(import.meta.dirname, 'files/photo.heic'))];

// PT-128: iOS Safari converts a picked photo to the first type the picker lists unless the list
// takes HEIC, which the server can neither shrink nor strip of its GPS location.
test.describe('HEIC photos', () => {
  test('the file picker asks for JPEG first and never for HEIC', async ({ page, api }) => {
    await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Existing ticket' }]);
    await page.goto('/p/MOB/1');
    const accept = (await page.getByLabel('Add files to ticket').getAttribute('accept')) ?? '';
    expect(accept.split(',')[0]).toBe('image/jpeg');
    expect(accept).not.toMatch(/heic|heif/i);
  });

  test('desktop: a HEIC dropped on the New ticket sheet is still attached, as it came', async ({
    page,
    api,
  }, info) => {
    test.skip(isPhone(info.project.name), 'Files are dragged on desktop.');
    await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Existing ticket' }]);
    await page.goto('/p/MOB');
    await openNewTicketIn(page, 'To do');
    const sheet = page.getByRole('dialog', { name: 'New ticket' });
    await sheet.getByLabel('Ticket title').fill('Photo from a Mac');
    const dataTransfer = await page.evaluateHandle((bytes) => {
      const data = new DataTransfer();
      data.items.add(new File([new Uint8Array(bytes)], 'IMG_0006.HEIC', { type: 'image/heic' }));
      return data;
    }, HEIC);
    const description = sheet.getByLabel('Description', { exact: true });
    await description.dispatchEvent('dragenter', { dataTransfer });
    await description.dispatchEvent('dragover', { dataTransfer });
    await description.dispatchEvent('drop', { dataTransfer });
    await expect(sheet.getByRole('progressbar')).toHaveCount(0);

    await sheet.getByRole('button', { name: 'Create' }).click();
    await expect(toast(page, 'MOB-2 created')).toBeVisible();
    const created = await api.getTicket('MOB-2');
    expect(created.attachments.map((file) => [file.fileName, file.mimeType, file.size])).toEqual([
      ['IMG_0006.HEIC', 'image/heic', HEIC.length],
    ]);
  });
});
