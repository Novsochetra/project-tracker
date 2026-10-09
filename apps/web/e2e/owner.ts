import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { APIRequestContext, Page } from '@playwright/test';
import { expect } from './fixtures';
import { API_URL } from './ports';

export const REPO_ROOT = fileURLToPath(new URL('../../..', import.meta.url));
export const OWNER = { email: 'owner@example.com', password: 'correct horse battery' };

// The way the owner sets the account up for real: the command, with the password piped in.
export function setOwner(): void {
  const dataDir = process.env.E2E_DATA_DIR;
  if (!dataDir) throw new Error('playwright.config.ts sets E2E_DATA_DIR.');
  execFileSync('npx', ['tsx', 'apps/server/src/cli/setOwner.ts', '--email', OWNER.email], {
    cwd: REPO_ROOT,
    input: `${OWNER.password}\n`,
    env: { ...process.env, DATABASE_URL: join(dataDir, 'e2e.db') },
  });
}

// The next test starts on an open tracker again: the reset that removes the owner needs a session.
export async function removeOwner(request: APIRequestContext): Promise<void> {
  const signIn = await request.post(`${API_URL}/api/session`, { data: OWNER });
  if (signIn.status() !== 200) return;
  expect((await request.post(`${API_URL}/api/test/reset`)).status()).toBe(204);
}

export async function signIn(page: Page, password: string = OWNER.password): Promise<void> {
  await page.getByLabel('Email').fill(OWNER.email);
  await page.getByLabel('Password').fill(password);
  await page.getByLabel('Password').press('Enter');
}
