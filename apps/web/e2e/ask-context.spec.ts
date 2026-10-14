import { randomUUID } from 'node:crypto';
import { ask, HELPER } from './askChat';
import { expect, test } from './fixtures';
import { seedProject, settledScreenshot } from './helpers';

const HINT = 'This chat is getting full. Start a new chat for a new task.';

test("shows how full Claude's context is, with the numbers a tap away", async ({
  page,
  api,
}, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seedProject(api, 'Mobile app', 'MOB');
  const helperId = randomUUID();
  await api.registerRunner(helperId, { name: HELPER, projectKeys: ['MOB'] });
  await page.goto('/p/MOB/ask/new');
  await ask(page, 'Make capture sync faster');
  await expect(page.getByRole('button', { name: /^Context/ })).toHaveCount(0);
  const job = await api.takeNextRun(helperId, 'ask');
  await api.finishRun(job!.run.id, {
    status: 'done',
    answer: 'Done.',
    sessionId: randomUUID(),
    usage: { contextTokens: 170_000, contextWindow: 200_000, tokens: 1_240_000 },
  });

  const meter = page.getByRole('button', { name: 'Context 85%' });
  await expect(meter).toBeVisible();
  await expect(page.getByText(HINT)).toBeVisible();
  await meter.click();
  await expect(page.getByText("170,000 of 200,000 tokens in Claude's context")).toBeVisible();
  await expect(page.getByText('This chat used 1,240,000 tokens in all')).toBeVisible();

  const own = page.viewportSize()!;
  for (const width of [320, own.width]) {
    await page.setViewportSize({ width, height: own.height });
    const box = (await meter.boundingBox())!;
    expect(box.x + box.width, `the meter at ${width}px`).toBeLessThanOrEqual(width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    await settledScreenshot(page, info.outputPath(`ask-context-${width}.png`));
  }
});
