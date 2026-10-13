import { randomUUID } from 'node:crypto';
import { answer, ask, HELPER } from './askChat';
import { doubleTap } from './doubleTap';
import { expect, test } from './fixtures';
import { seedProject, settledScreenshot, toast } from './helpers';

const card = (title: string, priority: string) => [
  '````ticket',
  `title: ${title}`,
  `priority: ${priority}`,
  '---',
  '## Why',
  `${title}.`,
  '````',
];

const SPLIT = [
  'Here is the plan as three tickets, in order:',
  ...card('Queue captures offline', 'high'),
  ...card('Send the queue in batches', 'medium'),
  ...card('Show the sync state', 'low'),
  'Tap Create all, or change any card first.',
].join('\n');

test('turns an answer with three cards into three tickets with one tap', async ({
  page,
  api,
}, info) => {
  await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Crash when rotating' }]);
  const helperId = randomUUID();
  await api.registerRunner(helperId, { name: HELPER, projectKeys: ['MOB'] });
  await page.goto('/p/MOB/ask/new');
  await ask(page, 'Split this into tickets');
  await answer(api, helperId, SPLIT);

  const cards = page.getByRole('region', { name: 'Ticket card', exact: true });
  await expect(cards).toHaveCount(3);
  await cards
    .nth(1)
    .getByRole('textbox', { name: 'Ticket title' })
    .fill('Send captures in batches');
  const createAll = page.getByRole('button', { name: 'Create all' });
  await createAll.scrollIntoViewIfNeeded();
  await settledScreenshot(page, info.outputPath(`cards-${info.project.name}.png`));
  await doubleTap(page, createAll, Boolean(info.project.use.hasTouch));

  const keys = ['MOB-2', 'MOB-3', 'MOB-4'];
  for (const key of keys) {
    const made = page.getByRole('region', { name: `Ticket ${key}` });
    await expect(made.getByRole('button', { name: `Run ${key} in Claude Code` })).toBeVisible();
  }
  await expect(createAll).toBeHidden();
  await expect(cards).toHaveCount(0);
  const tickets = await api.listTickets('MOB');
  const made = tickets.filter((ticket) => keys.includes(ticket.key));
  expect(made.map((ticket) => [ticket.key, ticket.title, ticket.priority]).sort()).toEqual([
    ['MOB-2', 'Queue captures offline', 'high'],
    ['MOB-3', 'Send captures in batches', 'medium'],
    ['MOB-4', 'Show the sync state', 'low'],
  ]);
  expect(tickets).toHaveLength(4);
  await settledScreenshot(page, info.outputPath(`created-${info.project.name}.png`));

  await page.reload();
  await expect(page.getByRole('region', { name: 'Ticket MOB-4' })).toBeVisible();
  await expect(createAll).toBeHidden();

  await page
    .getByRole('region', { name: 'Ticket MOB-3' })
    .getByRole('button', { name: 'Run MOB-3 in Claude Code' })
    .click();
  await expect(toast(page, `Sent to Claude on ${HELPER}`)).toBeVisible();
  const job = await api.takeNextRun(helperId, 'ticket');
  expect(job?.run).toMatchObject({ kind: 'ticket', ticketKey: 'MOB-3', role: 'work' });
});
