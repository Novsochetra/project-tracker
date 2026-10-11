import type { Locator, Page } from '@playwright/test';
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

interface TapClicks {
  tapClicks: number[];
}

// The page's clock at each click, from its first load on: an init script (page.addInitScript).
export const recordClicks = () => {
  const clicks: number[] = [];
  Object.assign(window, { tapClicks: clicks } satisfies TapClicks);
  window.addEventListener('click', () => clicks.push(performance.now()), true);
};

export const clearClicks = (page: Page): Promise<void> =>
  page.evaluate(() => {
    (window as unknown as TapClicks).tapClicks.length = 0;
  });

// The page's clock at each click since it loaded or clearClicks.
export const clickTimes = (page: Page): Promise<number[]> =>
  page.evaluate(() => (window as unknown as TapClicks).tapClicks);

// A ••• menu's delete confirm takes no clicks for 500 ms after it appears (CLICK_SHIELD_MS in
// components/FloatingPanel), so a test reads it first, like a person.
export const readMenuConfirm = (page: Page): Promise<void> => page.waitForTimeout(500);

// A phone's action sheet takes no taps on its rows for 500 ms after they appear (lib/clickShield),
// so a test reads them first, like a person. Desktop menus take clicks at once; the wait is harmless.
export const readActionSheet = (page: Page): Promise<void> => page.waitForTimeout(500);

// What moves in script, which settled() can't see, has come to rest when two reads 100 ms apart
// agree.
export async function resting(read: () => Promise<number>): Promise<number> {
  let last = Number.NaN;
  await expect
    .poll(
      async () => {
        const value = await read();
        const still = value === last;
        last = value;
        return still;
      },
      { intervals: [100] },
    )
    .toBe(true);
  return last;
}

const SETTLE_MS = 3_000;

// A box read while it rises, slides or grows in is not where it comes to rest, and it moves with
// its ancestors' animations as well as its own and its children's. Endless ones (spinners) never
// finish and a paused one does not move, so neither is waited for.
export async function settled(locator: Locator): Promise<void> {
  const moving = await locator.evaluate(async (element, limit) => {
    const name = (animation: Animation) =>
      animation instanceof CSSAnimation
        ? `animation "${animation.animationName}"`
        : animation instanceof CSSTransition
          ? `transition of ${animation.transitionProperty}`
          : `script animation "${animation.id}"`;
    const where = (animation: Animation) => {
      const target = animation.effect instanceof KeyframeEffect ? animation.effect.target : null;
      return target ? [target.tagName.toLowerCase(), ...target.classList].join('.') : 'no element';
    };
    const running = () => {
      const animations = element.getAnimations({ subtree: true });
      for (let node = element.parentElement; node; node = node.parentElement) {
        animations.push(...node.getAnimations());
      }
      return animations.filter(
        (animation) =>
          animation.playState === 'running' &&
          animation.effect?.getComputedTiming().endTime !== Infinity,
      );
    };
    await document.fonts.ready;
    const deadline = performance.now() + limit;
    for (let left = running(); left.length > 0; left = running()) {
      const rest = deadline - performance.now();
      if (rest <= 0) return left.map((animation) => `${name(animation)} on ${where(animation)}`);
      // A cancelled animation rejects: it has stopped, which is all this waits for.
      const ended = Promise.all(left.map((animation) => animation.finished.catch(() => null)));
      await Promise.race([ended, new Promise((resolve) => setTimeout(resolve, rest))]);
    }
    return [];
  }, SETTLE_MS);
  if (moving.length > 0) {
    throw new Error(
      `${locator.toString()} still moves after ${SETTLE_MS} ms: ${moving.join('; ')}`,
    );
  }
}

// A list or card that fades in fills backwards, and reduced motion only shortens that, so a
// screenshot before its first frame shows it hidden.
export async function settledScreenshot(page: Page, path: string): Promise<void> {
  await settled(page.locator('body'));
  await page.screenshot({ path });
}
