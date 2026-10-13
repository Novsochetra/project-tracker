import { randomUUID } from 'node:crypto';
import type { TrackerClient } from '@tracker/client';
import { expect, test } from './fixtures';
import { seedProject, settledScreenshot } from './helpers';

const HELPER = "Dara's MacBook";

const WHITEBOARD = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

// The helper's side (apps/agent/src/watch/ask/askFiles): it takes the question, downloads its
// files with its own token and answers only when they arrived whole.
async function answerWithFiles(api: TrackerClient, helperId: string): Promise<string[]> {
  const job = await api.takeNextRun(helperId, 'ask');
  const files = job?.files ?? [];
  const names: string[] = [];
  for (const file of files) {
    const bytes = Buffer.from(await (await api.fetchAttachment(file.id)).arrayBuffer());
    expect(bytes.byteLength).toBe(file.size);
    expect(bytes.subarray(0, 4)).toEqual(PNG_SIGNATURE);
    names.push(file.fileName);
  }
  expect(job?.prompt).toContain('(Sent with it: whiteboard.png)');
  await api.finishRun(job!.run.id, {
    status: 'done',
    answer: `I read ${names.join(', ')}: two tickets.`,
    sessionId: randomUUID(),
  });
  return names;
}

test('sends a photo with a question, and Claude reads it', async ({ page, api }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seedProject(api, 'Mobile app', 'MOB');
  const helperId = randomUUID();
  await api.registerRunner(helperId, { name: HELPER, projectKeys: ['MOB'] });
  await page.goto('/p/MOB/ask/new');

  const box = page.getByRole('textbox', { name: 'Question for Claude' });
  await box.fill('Turn this into tickets');
  await page
    .getByLabel('Attach files to question')
    .setInputFiles({ name: 'whiteboard.png', mimeType: 'image/png', buffer: WHITEBOARD });
  const composer = page.locator('form').filter({ has: box });
  await expect(composer.getByRole('img', { name: 'Image 1' })).toBeVisible();
  const boxRect = (await box.boundingBox())!;
  const line = await box.evaluate((field) => parseFloat(getComputedStyle(field).lineHeight));
  expect(boxRect.height, 'the box stays one line').toBeLessThan(line * 2);
  await settledScreenshot(page, info.outputPath(`ask-files-picked-${info.project.name}.png`));

  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.getByText(`Claude is thinking on ${HELPER}…`)).toBeVisible();
  await expect(composer.getByRole('img', { name: 'Image 1' })).toHaveCount(0);

  expect(await answerWithFiles(api, helperId)).toEqual(['whiteboard.png']);
  const messages = page.getByRole('list', { name: 'Messages' });
  await expect(messages.getByRole('article', { name: 'Claude' })).toContainText(
    'I read whiteboard.png: two tickets.',
  );
  const mine = messages.getByRole('article', { name: 'You' });
  await expect(mine).toContainText('Turn this into tickets');
  await settledScreenshot(page, info.outputPath(`ask-files-sent-${info.project.name}.png`));

  await mine.getByRole('button', { name: 'Open image 1' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
});
