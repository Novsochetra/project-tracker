import type { Page } from '@playwright/test';
import type { TrackerClient } from '@tracker/client';
import type { Priority } from '@tracker/shared';
import { expect } from './fixtures';

export interface TicketSeed {
  title: string;
  status?: string;
  priority?: Priority;
  description?: string;
  assignee?: string;
  due?: string;
}

export async function seedProject(
  api: TrackerClient,
  name: string,
  key: string,
  tickets: TicketSeed[] = [],
): Promise<void> {
  const { statuses } = await api.createProject({ name, key, repo: '~/code/demo' });
  for (const ticket of tickets) {
    await api.createTicket(key, {
      title: ticket.title,
      description: ticket.description ?? '',
      priority: ticket.priority ?? 'medium',
      assignee: ticket.assignee ?? '',
      due: ticket.due ?? '',
      statusId: statuses.find((s) => s.name === (ticket.status ?? 'To do'))?.id,
    });
  }
}

export const group = (page: Page, statusName: string) =>
  page.getByRole('region', { name: statusName, exact: true });

export const ticketRow = (page: Page, key: string) =>
  page.getByRole('button', { name: new RegExp(`^${key}\\b`) }).first();

export const toast = (page: Page, text: string) => page.getByText(text, { exact: true });

export async function openNewTicketIn(page: Page, statusName: string): Promise<void> {
  await page.getByRole('button', { name: `New ticket in ${statusName}` }).click();
  await expect(page.getByRole('dialog', { name: 'New ticket' })).toBeVisible();
}

export async function createTicketInSheet(page: Page, title: string): Promise<void> {
  const dialog = page.getByRole('dialog', { name: 'New ticket' });
  await dialog.getByLabel('Ticket title').fill(title);
  await dialog.getByRole('button', { name: 'Create' }).click();
  await expect(dialog).toBeHidden();
}

export async function pickFromListbox(page: Page, trigger: string, option: string): Promise<void> {
  await page.getByRole('button', { name: new RegExp(`^${trigger}`) }).click();
  const listbox = page.getByRole('listbox', { name: trigger });
  await expect(listbox).toBeVisible();
  await listbox.getByRole('option', { name: option, exact: true }).click();
  await expect(listbox).toBeHidden();
}

export const activity = (page: Page) => page.getByRole('region', { name: 'Activity' });
