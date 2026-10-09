import type { BrowserContext, Page } from '@playwright/test';
import { expect } from './fixtures';

// Two tabs of one browser on ticket MOB-1, for the drafts' cross-tab checks.

export const titleOf = (page: Page) => page.getByLabel('Title', { exact: true });
export const note = (page: Page) => page.getByText(/isn't saved yet|changed elsewhere/);

export async function open(context: BrowserContext, existing?: Page): Promise<Page> {
  const page = existing ?? (await context.newPage());
  await page.goto('/p/MOB/1');
  await expect(titleOf(page)).toHaveValue('Ticket 1');
  return page;
}

export async function typeAtEnd(page: Page, text: string): Promise<void> {
  const title = titleOf(page);
  // Not a click: on a loaded machine the layout can still shift under it, and the keys go nowhere.
  await title.focus();
  await title.evaluate((field: HTMLTextAreaElement) =>
    field.setSelectionRange(field.value.length, field.value.length),
  );
  await page.keyboard.type(text, { delay: 20 });
  await title.blur();
}

// Holds the page's requests of one method to a path until released, as a connection that stalls
// would; `fail` ends them as a dropped connection instead.
export async function hold(page: Page, method: string, path: (url: URL) => boolean) {
  let release: (how: 'go' | 'fail') => void = () => undefined;
  const held = new Promise<'go' | 'fail'>((resolve) => (release = resolve));
  await page.route(path, async (route) => {
    if (route.request().method() !== method) return route.fallback();
    const how = await held;
    if (how === 'fail') await route.abort('failed').catch(() => undefined);
    else await route.continue().catch(() => undefined);
  });
  return release;
}

// Holds the page's saves of the ticket until released.
export async function holdSaves(page: Page): Promise<() => void> {
  const release = await hold(page, 'PATCH', (url) => url.pathname === '/api/tickets/MOB-1');
  return () => release('go');
}
