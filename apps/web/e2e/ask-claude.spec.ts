import { randomUUID } from 'node:crypto';
import type { TrackerClient } from '@tracker/client';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { seedProject, toast } from './helpers';

const HELPER = "Dara's MacBook";

const card = (title: string, priority: string, steps: string) =>
  [
    'Here is a ticket for it:',
    '````ticket',
    `title: ${title}`,
    `priority: ${priority}`,
    '---',
    '## Why',
    'Captures take 40 s to sync on 3G.',
    '',
    '## Steps',
    steps,
    '````',
    'Tell me what to change, or tap Create.',
  ].join('\n');

// The helper's side, as `tracker watch` reports an answer (apps/agent/src/watch/ask).
async function answer(api: TrackerClient, helperId: string, text: string): Promise<void> {
  const job = await api.takeNextRun(helperId, 'ask');
  expect(job?.run.kind).toBe('ask');
  await api.finishRun(job!.run.id, { status: 'done', answer: text, sessionId: randomUUID() });
}

async function ask(page: Page, question: string): Promise<void> {
  await page.getByRole('textbox', { name: 'Question for Claude' }).fill(question);
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.getByText(`Claude is thinking on ${HELPER}…`)).toBeVisible();
}

test('asks Claude about a project, shapes a ticket card, creates it and runs it', async ({
  page,
  api,
}) => {
  await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Crash when rotating' }]);
  const helperId = randomUUID();
  await api.registerRunner(helperId, { name: HELPER, projectKeys: ['MOB'] });
  await page.goto('/p/MOB');

  await page.getByRole('button', { name: 'Ask Claude' }).click();
  await expect(page).toHaveURL(/\/p\/MOB\/ask$/);
  await page.getByRole('button', { name: 'New chat' }).first().click();
  await ask(page, 'How does capture sync work?');
  await expect(page).toHaveURL(/\/p\/MOB\/ask\/[\w-]+$/);
  await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeDisabled();

  await answer(api, helperId, 'Captures wait in a queue and go when the tracker answers.');
  const messages = page.getByRole('list', { name: 'Messages' });
  await expect(messages.getByRole('article', { name: 'Claude' })).toContainText('wait in a queue');
  await expect(page.getByText(/Claude is thinking/)).toBeHidden();

  await ask(page, 'Make a ticket to make it faster');
  await answer(api, helperId, card('Faster capture sync', 'medium', '1. Batch.\n2. Send all.'));
  await expect(page.getByRole('region', { name: 'Ticket card', exact: true })).toBeVisible();

  await ask(page, 'Make step 2 smaller, priority high');
  await answer(api, helperId, card('Faster capture sync', 'high', '1. Batch.\n2. Send two.'));
  await expect(page.getByRole('region', { name: 'Replaced ticket card' })).toBeVisible();
  const ticketCard = page.getByRole('region', { name: 'Ticket card', exact: true });
  await expect(ticketCard).toHaveCount(1);
  await ticketCard.getByRole('textbox', { name: 'Ticket title' }).fill('Sync captures faster');
  await ticketCard.getByRole('button', { name: 'Create' }).click();

  const made = page.getByRole('region', { name: 'Ticket MOB-2' });
  await expect(made).toContainText('Sync captures faster');
  const ticket = await api.getTicket('MOB-2');
  expect(ticket.ticket).toMatchObject({ title: 'Sync captures faster', priority: 'high' });
  expect(ticket.ticket.description).toContain('2. Send two.');

  await made.getByRole('button', { name: 'Run MOB-2 in Claude Code' }).click();
  await expect(toast(page, `Sent to Claude on ${HELPER}`)).toBeVisible();
  await expect(made).toContainText(`Claude is working on ${HELPER}…`);
  const job = await api.takeNextRun(helperId, 'ticket');
  expect(job?.run).toMatchObject({ kind: 'ticket', ticketKey: 'MOB-2' });
  expect(job?.prompt).toContain('MOB-2');
  await api.finishRun(job!.run.id, { status: 'done' });
  await expect(made).not.toContainText('Claude is working');

  await made.getByRole('link', { name: 'MOB-2' }).click();
  await expect(page).toHaveURL(/\/p\/MOB\/2$/);
});

test('offers no Send without a helper online, and cancels a question', async ({ page, api }) => {
  await seedProject(api, 'Mobile app', 'MOB');
  await page.goto('/p/MOB/ask/new');
  await expect(page.getByRole('button', { name: 'set up your computer' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send', exact: true })).toHaveCount(0);

  await api.registerRunner(randomUUID(), { name: HELPER, projectKeys: ['MOB'] });
  await page.reload();
  await ask(page, 'Where is the login screen?');
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByText(/Claude is thinking/)).toBeHidden();
  await expect(page.getByRole('list', { name: 'Messages' })).toContainText(
    'Where is the login screen?',
  );
});
