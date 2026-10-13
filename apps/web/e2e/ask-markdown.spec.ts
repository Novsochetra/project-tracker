import { randomUUID } from 'node:crypto';
import type { TrackerClient } from '@tracker/client';
import type { Page } from '@playwright/test';
import { expect, isPhone, test } from './fixtures';
import { seedProject, settledScreenshot } from './helpers';

const HELPER = "Dara's MacBook";

const ANSWER = [
  '# Sync plan',
  'Captures **wait** in a *queue* and go when the tracker answers. See https://x.dev/docs.',
  '## Steps',
  '1. Batch the captures\n2. Send them with `fetch`\n   - retry on a 5xx',
  '> Drafts stay on the phone until the tracker has them.',
  '```ts',
  "const queue = await openQueue({ name: 'captures', retries: 3, backoffMs: 1000, onDrop: (item) => log(item) });",
  '```',
  '| File | What changes | Lines | Owner | Risk |',
  '|---|---|--:|---|---|',
  '| apps/web/src/features/capture/sync/queue.ts | Batch captures before sending | 120 | web | Low |',
  '| apps/server/src/http/routes/captures.ts | Take a batch in one request | 64 | server | Medium |',
].join('\n');

async function openChat(page: Page, api: TrackerClient): Promise<string> {
  await seedProject(api, 'Mobile app', 'MOB', []);
  const helperId = randomUUID();
  await api.registerRunner(helperId, { name: HELPER, projectKeys: ['MOB'] });
  await page.goto('/p/MOB/ask/new');
  await page.getByRole('textbox', { name: 'Question for Claude' }).fill('How does sync work?');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page).toHaveURL(/\/p\/MOB\/ask\/[\w-]+$/);
  await expect(page.getByText(`Claude is thinking on ${HELPER}…`)).toBeVisible();
  return helperId;
}

// The helper's side, as `tracker watch` reports an answer (apps/agent/src/watch/ask).
async function answer(api: TrackerClient, helperId: string, text: string): Promise<void> {
  const job = await api.takeNextRun(helperId, 'ask');
  await api.finishRun(job!.run.id, { status: 'done', answer: text, sessionId: randomUUID() });
}

const claude = (page: Page) =>
  page.getByRole('list', { name: 'Messages' }).getByRole('article', { name: 'Claude' });

async function expectNoSidewaysScroll(page: Page): Promise<void> {
  const path = new URL(page.url()).pathname;
  const scroller = page.locator(`[data-stack-path="${path}"] [data-stack-scroller]`);
  const [scrollWidth, clientWidth] = await scroller.evaluate((element) => [
    element.scrollWidth,
    element.clientWidth,
  ]);
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  const [documentWidth, viewWidth] = await page.evaluate(() => [
    document.documentElement.scrollWidth,
    innerWidth,
  ]);
  expect(documentWidth).toBeLessThanOrEqual(viewWidth);
}

test('shows an answer with headings, a list, code and a table without a sideways page scroll', async ({
  page,
  api,
}, info) => {
  const helperId = await openChat(page, api);
  await answer(api, helperId, ANSWER);
  const message = claude(page);
  await expect(message.getByRole('heading', { level: 1, name: 'Sync plan' })).toBeVisible();
  await expect(message.getByRole('heading', { level: 2, name: 'Steps' })).toBeVisible();
  await expect(message.getByText('wait', { exact: true })).toHaveCSS('font-weight', '600');
  await expect(message.getByRole('listitem').filter({ hasText: /^retry on a 5xx$/ })).toBeVisible();
  await expect(message.getByRole('link', { name: 'https://x.dev/docs' })).toBeVisible();
  await expect(message.getByRole('cell', { name: 'Take a batch in one request' })).toBeVisible();

  const code = message.locator('pre');
  const [codeScroll, codeWidth] = await code.evaluate((box) => [box.scrollWidth, box.clientWidth]);
  expect(codeScroll).toBeGreaterThan(codeWidth);
  await expectNoSidewaysScroll(page);
  await settledScreenshot(page, info.outputPath(`ask-markdown-${info.project.name}.png`));

  if (isPhone(info.project.name)) {
    await page.setViewportSize({ width: 320, height: 568 });
    await expect(message.getByRole('table')).toBeVisible();
    await expectNoSidewaysScroll(page);
    const table = message.getByRole('table').locator('..');
    const [tableScroll, tableWidth] = await table.evaluate((box) => [
      box.scrollWidth,
      box.clientWidth,
    ]);
    expect(tableScroll).toBeGreaterThan(tableWidth);
    await settledScreenshot(page, info.outputPath(`ask-markdown-320.png`));
  }
});

test('shows HTML in an answer as text', async ({ page, api }) => {
  const helperId = await openChat(page, api);
  const html = [
    '<script>window.hacked = true</script>',
    '<img src="x" onerror="window.hacked = true">',
  ];
  await answer(api, helperId, html.join('\n\n'));
  const message = claude(page);
  for (const text of html) await expect(message.getByText(text, { exact: true })).toBeVisible();
  await expect(message.locator('img, script')).toHaveCount(0);
  expect(await page.evaluate(() => (window as { hacked?: boolean }).hacked)).toBeUndefined();
});

test('shows a 100,000-character answer without freezing the page', async ({ page, api }) => {
  const helperId = await openChat(page, api);
  const long = `${ANSWER}\n\n`.repeat(Math.ceil(100_000 / (ANSWER.length + 2))).slice(0, 99_990);
  const start = Date.now();
  await answer(api, helperId, `${long}\n\nThe end.`);
  await expect(claude(page).getByText('The end.', { exact: true })).toBeVisible({
    timeout: 10_000,
  });
  // It landed over SSE and a read of the chat, so the budget is wide; a frozen page took longer.
  expect(Date.now() - start).toBeLessThan(5_000);
  const box = page.getByRole('textbox', { name: 'Question for Claude' });
  await box.fill('Still typing');
  await expect(box).toHaveValue('Still typing');
  await expectNoSidewaysScroll(page);
});
