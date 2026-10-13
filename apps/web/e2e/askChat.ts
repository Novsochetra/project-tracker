import { randomUUID } from 'node:crypto';
import type { Page } from '@playwright/test';
import type { TrackerClient } from '@tracker/client';
import { expect } from './fixtures';

export const HELPER = "Dara's MacBook";

// The helper's side, as `tracker watch` reports an answer (apps/agent/src/watch/ask).
export async function answer(api: TrackerClient, helperId: string, text: string): Promise<void> {
  const job = await api.takeNextRun(helperId, 'ask');
  expect(job?.run.kind).toBe('ask');
  await api.finishRun(job!.run.id, { status: 'done', answer: text, sessionId: randomUUID() });
}

export async function ask(page: Page, question: string): Promise<void> {
  await page.getByRole('textbox', { name: 'Question for Claude' }).fill(question);
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.getByText(`Claude is thinking on ${HELPER}…`)).toBeVisible();
}
