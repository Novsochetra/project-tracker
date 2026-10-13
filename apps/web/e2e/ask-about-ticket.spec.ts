import { randomUUID } from 'node:crypto';
import { expect, test, usesPhoneLayout } from './fixtures';
import { seedProject, settledScreenshot } from './helpers';

const HELPER = "Dara's MacBook";

test('asks Claude about a ticket from its screen, with its context, and keeps the chat when it goes', async ({
  page,
  api,
}, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seedProject(api, 'Mobile app', 'MOB', [
    { title: 'Crash when rotating', description: 'The app quits on rotate.' },
  ]);
  await api.addComment('MOB-1', { text: 'Only on the iPad' });
  const helperId = randomUUID();
  await api.registerRunner(helperId, { name: HELPER, projectKeys: ['MOB'] });
  await page.goto('/p/MOB/1');
  await expect(page.getByRole('button', { name: 'Ask Claude', exact: true })).toBeVisible();
  await settledScreenshot(page, info.outputPath(`ticket-ask-claude-${info.project.name}.png`));

  await page.getByRole('button', { name: 'Ask Claude', exact: true }).click();
  await expect(page).toHaveURL(/\/p\/MOB\/1\/ask\/new$/);
  const ticketLink = page.getByRole('link', { name: 'About MOB-1 Crash when rotating' });
  await expect(ticketLink).toBeVisible();
  await settledScreenshot(page, info.outputPath(`ask-about-ticket-${info.project.name}.png`));

  const box = page.getByRole('textbox', { name: 'Question for Claude' });
  await expect(box).toHaveAttribute('placeholder', 'Ask about this ticket…');
  await box.fill('Why does it quit?');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page).toHaveURL(/\/p\/MOB\/1\/ask\/[\w-]+$/);
  const job = await api.takeNextRun(helperId, 'ask');
  expect(job?.prompt).toContain('## MOB-1: Crash when rotating');
  expect(job?.prompt).toContain('The app quits on rotate.');
  expect(job?.prompt).toContain('- Only on the iPad');
  await api.finishRun(job!.run.id, {
    status: 'done',
    answer: 'The layout reads a stale size.',
    sessionId: randomUUID(),
  });
  await expect(page.getByRole('article', { name: 'Claude' })).toContainText('stale size');
  await expect(ticketLink).toBeVisible();
  const chatPath = new URL(page.url()).pathname;

  if (await usesPhoneLayout(page))
    await page.getByRole('button', { name: 'Back to MOB-1' }).click();
  else await page.getByRole('navigation', { name: 'Breadcrumb' }).getByText('MOB-1').click();
  await expect(page).toHaveURL(/\/p\/MOB\/1$/);

  await api.deleteTicket('MOB-1');
  await page.goto(chatPath);
  await expect(page.getByRole('article', { name: 'Claude' })).toContainText('stale size');
  await expect(page.getByRole('link', { name: /^About MOB-1/ })).toHaveCount(0);
});
