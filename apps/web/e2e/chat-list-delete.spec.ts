import { randomUUID } from 'node:crypto';
import type { TrackerClient } from '@tracker/client';
import type { Page } from '@playwright/test';
import { expect, test, usesPhoneLayout } from './fixtures';
import {
  readActionSheet,
  readMenuConfirm,
  seedProject,
  settledScreenshot,
  swipeLeft,
  toast,
} from './helpers';

const QUESTION = 'Delete this chat? Its messages are gone for good. Tickets made from it stay.';

// The helper's side, as `tracker watch` reports an answer (apps/agent/src/watch/ask).
async function answeredChat(api: TrackerClient, runnerId: string, text: string): Promise<void> {
  await api.startChat('MOB', { runnerId, text });
  const job = await api.takeNextRun(runnerId, 'ask');
  await api.finishRun(job!.run.id, { status: 'done', answer: 'Sure.', sessionId: randomUUID() });
}

const chatRow = (page: Page, title: string) =>
  page
    .getByRole('region', { name: 'Chats' })
    .getByRole('button', { name: new RegExp(`^${title}`) });

async function deleteOnPhone(page: Page, title: string, shot: string): Promise<void> {
  await swipeLeft(chatRow(page, title));
  await settledScreenshot(page, shot);
  // WebKit's hit test still finds the row while the action springs open.
  await page.getByRole('button', { name: 'Delete', exact: true }).dispatchEvent('click');
  const sheet = page.getByRole('dialog', { name: 'Delete chat' });
  await expect(sheet).toContainText(QUESTION);
}

async function deleteOnDesktop(page: Page, title: string, shot: string): Promise<void> {
  await chatRow(page, title).hover();
  await page.getByRole('button', { name: `Options for ${title}` }).click();
  await page.getByRole('button', { name: 'Delete chat' }).click();
  await expect(page.getByRole('alert')).toContainText(QUESTION);
  await settledScreenshot(page, shot);
}

test('deletes a chat from the chat list: a swipe on phones, the row’s ••• on desktop', async ({
  page,
  api,
}, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seedProject(api, 'Mobile app', 'MOB');
  const runnerId = randomUUID();
  await api.registerRunner(runnerId, { name: "Dara's MacBook", projectKeys: ['MOB'] });
  await answeredChat(api, runnerId, 'How does capture sync work');
  await answeredChat(api, runnerId, 'Where is the login code');
  await page.goto('/p/MOB/ask');
  await expect(chatRow(page, 'Where is the login code')).toBeVisible();

  const phone = await usesPhoneLayout(page);
  await (phone ? deleteOnPhone : deleteOnDesktop)(
    page,
    'How does capture sync work',
    info.outputPath(`chat-list-delete-${info.project.name}.png`),
  );
  if (phone) {
    await readActionSheet(page);
    await page.getByRole('button', { name: 'Delete chat' }).click();
  } else {
    await readMenuConfirm(page);
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
  }

  await expect(toast(page, 'Chat deleted')).toBeVisible();
  await expect(chatRow(page, 'How does capture sync work')).toHaveCount(0);
  await expect(chatRow(page, 'Where is the login code')).toBeVisible();
  await expect(page).toHaveURL(/\/p\/MOB\/ask$/);
  expect((await api.listChats('MOB')).map((chat) => chat.title)).toEqual([
    'Where is the login code',
  ]);
});
