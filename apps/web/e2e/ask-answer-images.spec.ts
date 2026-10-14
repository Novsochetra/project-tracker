import { randomUUID } from 'node:crypto';
import { crc32, deflateSync } from 'node:zlib';
import { ask, HELPER } from './askChat';
import { expect, test, usesPhoneLayout } from './fixtures';
import { seedProject, settledScreenshot } from './helpers';

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

// A grey screenshot wider than any phone, so the answer must shrink it to fit.
function widePng(width: number, height: number): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 0, 0, 0, 0], 8);
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(width, 0x99)]);
  const pixels = deflateSync(Buffer.concat(Array.from({ length: height }, () => row)));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', pixels),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const ANSWER =
  'Here is the home screen:\n\n````image\npath: docs/home.png\n````\n\nTap it to zoom.';

// PT-225: the helper uploads the picture an image card names and sends its id with the answer
// (apps/agent/src/watch/ask/answerImages).
test("shows a picture in Claude's answer that fits the screen and opens full size", async ({
  page,
  api,
}, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seedProject(api, 'Mobile app', 'MOB');
  const helperId = randomUUID();
  await api.registerRunner(helperId, { name: HELPER, projectKeys: ['MOB'] });
  await page.goto('/p/MOB/ask/new');
  await ask(page, 'Show me the home screen');

  const job = await api.takeNextRun(helperId, 'ask');
  const png = new Blob([new Uint8Array(widePng(1600, 900))], { type: 'image/png' });
  const picture = await api.uploadAttachment(png, 'home.png');
  await api.finishRun(job!.run.id, {
    status: 'done',
    answer: ANSWER,
    sessionId: randomUUID(),
    attachmentIds: [picture.id],
  });

  const claude = page
    .getByRole('list', { name: 'Messages' })
    .getByRole('article', { name: 'Claude' });
  await expect(claude).toContainText('Tap it to zoom.');
  await expect(claude).not.toContainText('path: docs/home.png');
  const open = claude.getByRole('button', { name: 'Open image 1' });
  const own = page.viewportSize()!;
  const widths = (await usesPhoneLayout(page)) ? [320, own.width] : [own.width];
  for (const width of widths) {
    await page.setViewportSize({ width, height: own.height });
    await expect(open.locator('img')).toHaveJSProperty('complete', true);
    const box = (await open.boundingBox())!;
    const words = (await claude.getByText('Tap it to zoom.').boundingBox())!;
    expect(box.x, `the picture's left at ${width}px`).toBeGreaterThanOrEqual(words.x - 1);
    expect(box.x + box.width, `the picture's right at ${width}px`).toBeLessThanOrEqual(width - 16);
    expect(box.height, `the picture keeps its shape at ${width}px`).toBeCloseTo(
      (box.width * 900) / 1600,
      -1,
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    );
    await settledScreenshot(page, info.outputPath(`ask-answer-image-${width}.png`));
  }

  await open.click();
  await expect(page.getByRole('dialog')).toBeVisible();
});
