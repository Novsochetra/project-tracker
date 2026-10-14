import { randomUUID } from 'node:crypto';
import type { Page } from '@playwright/test';
import { answer, ask, HELPER } from './askChat';
import { expect, test } from './fixtures';
import { seedProject, settledScreenshot } from './helpers';

const box = (page: Page) => page.getByRole('textbox', { name: 'Question for Claude' });
const queued = (page: Page, text: string) => page.getByRole('article', { name: `Queued: ${text}` });

async function queue(page: Page, text: string) {
  await box(page).fill(text);
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(queued(page, text)).toBeVisible();
}

const fitsWidth = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test('queues a message while Claude answers, runs it when the answer ends, and holds the queue after Stop', async ({
  page,
  api,
}, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seedProject(api, 'Mobile app', 'MOB');
  const helperId = randomUUID();
  await api.registerRunner(helperId, { name: HELPER, projectKeys: ['MOB'] });
  await page.goto('/p/MOB/ask/new');
  await ask(page, 'Where is the login screen?');

  await queue(page, 'And the sign-up screen?');
  await expect(page.getByRole('button', { name: 'Stop', exact: true })).toBeEnabled();
  const item = queued(page, 'And the sign-up screen?');
  await expect(item.getByText('Queued', { exact: true })).toBeVisible();
  await expect(item.getByRole('button', { name: 'Send now' })).toHaveCount(0);
  await item.getByRole('button', { name: 'Edit' }).click();
  await page.getByRole('textbox', { name: 'Queued message' }).fill('And the password reset?');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(queued(page, 'And the password reset?')).toBeVisible();
  expect(await fitsWidth(page)).toBe(true);
  await settledScreenshot(page, info.outputPath(`ask-queued-${info.project.name}.png`));

  await answer(api, helperId, 'In src/login.');
  const messages = page.getByRole('list', { name: 'Messages' });
  await expect(messages.getByRole('article', { name: 'You' }).last()).toContainText(
    'And the password reset?',
  );
  await expect(queued(page, 'And the password reset?')).toHaveCount(0);
  await expect(page.getByText(`Claude is thinking on ${HELPER}…`)).toBeVisible();

  await queue(page, 'And the docs?');
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await expect(page.getByText('Stopped.', { exact: true })).toBeVisible();
  const held = queued(page, 'And the docs?');
  await expect(held.getByText('Not sent', { exact: true })).toBeVisible();
  await expect(held.getByRole('button', { name: 'Send now' })).toBeVisible();
  expect(await fitsWidth(page)).toBe(true);
  await held.getByRole('button', { name: 'Send now' }).click();
  await expect(held).toHaveCount(0);
  await expect(page.getByText(`Claude is thinking on ${HELPER}…`)).toBeVisible();
});

test('removes a queued message before it runs', async ({ page, api }) => {
  await seedProject(api, 'Mobile app', 'MOB');
  const helperId = randomUUID();
  await api.registerRunner(helperId, { name: HELPER, projectKeys: ['MOB'] });
  await page.goto('/p/MOB/ask/new');
  await ask(page, 'Where is the login screen?');
  await queue(page, 'And the sign-up screen?');
  await queued(page, 'And the sign-up screen?').getByRole('button', { name: 'Remove' }).click();
  await expect(queued(page, 'And the sign-up screen?')).toHaveCount(0);
  await answer(api, helperId, 'In src/login.');
  await expect(page.getByText('In src/login.')).toBeVisible();
  await expect(page.getByText(/Claude is thinking/)).toBeHidden();
});
