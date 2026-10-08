import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ConnectSheet,
  NewTicketSheet,
  preloadParts,
  preloadRoute,
  ProjectScreen,
  PromptSheet,
  ReportSheet,
  StatusManagerSheet,
  TicketScreen,
} from './lazyParts';

const SHEETS = [NewTicketSheet, PromptSheet, ReportSheet, StatusManagerSheet, ConnectSheet];

afterEach(() => {
  vi.restoreAllMocks();
});

function spyAll() {
  const order: string[] = [];
  const spy = (part: { preload: () => Promise<unknown> }, name: string) =>
    vi.spyOn(part, 'preload').mockImplementation(() => {
      order.push(name);
      return Promise.resolve();
    });
  return {
    order,
    project: spy(ProjectScreen, 'project'),
    ticket: spy(TicketScreen, 'ticket'),
    sheets: SHEETS.map((sheet, index) => spy(sheet, `sheet ${index}`)),
  };
}

describe('preloadRoute', () => {
  it('loads nothing for Projects, which is in the first script', () => {
    const spies = spyAll();
    preloadRoute({ name: 'projects' });
    expect(spies.order).toEqual([]);
  });

  it('loads every screen of a deep link at once, and no sheets', () => {
    const spies = spyAll();
    preloadRoute({ name: 'ticket', key: 'MOB', num: 3 });
    expect(spies.order).toEqual(['project', 'ticket']);
  });

  it('stays quiet when a screen fails to load', async () => {
    vi.spyOn(ProjectScreen, 'preload').mockRejectedValue(new Error('offline'));
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    preloadRoute({ name: 'project', key: 'MOB' });
    await new Promise((resolve) => setTimeout(resolve, 0));
    process.off('unhandledRejection', unhandled);
    expect(unhandled).not.toHaveBeenCalled();
  });
});

describe('preloadParts', () => {
  it('loads the screens before the sheets', async () => {
    const spies = spyAll();
    await preloadParts();
    expect(spies.order.slice(0, 2)).toEqual(['project', 'ticket']);
    expect(spies.order.slice(2)).toHaveLength(SHEETS.length);
    spies.sheets.forEach((sheet) => expect(sheet).toHaveBeenCalledTimes(1));
  });

  it('still loads the sheets when a screen fails to load', async () => {
    const spies = spyAll();
    spies.ticket.mockRejectedValue(new Error('offline'));
    await preloadParts();
    spies.sheets.forEach((sheet) => expect(sheet).toHaveBeenCalledTimes(1));
  });
});
