import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeLocks } from '../test/fakeLocks';
import { isSentElsewhere, onOtherTabsMarks, SAVE_MARKS_STORAGE_KEY } from './saveMarks';

const ID = 'comment-edit:c1';

async function otherTab() {
  vi.resetModules();
  return import('./saveMarks');
}

const marksStored = () =>
  Object.keys(localStorage).filter((key) => key.startsWith(SAVE_MARKS_STORAGE_KEY));

describe('other tabs’ marks', () => {
  let locks: ReturnType<typeof fakeLocks>;

  beforeEach(() => {
    localStorage.clear();
    locks = fakeLocks();
  });

  afterEach(() => {
    locks.restore();
    vi.useRealTimers();
  });

  it('stop counting once their page has gone, though it left them in storage', async () => {
    const tab = await otherTab();
    tab.markSending(ID, true);
    const news = vi.fn();
    const stop = onOtherTabsMarks(news);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(isSentElsewhere(ID)).toBe(true);
    expect(marksStored()).toHaveLength(1);

    locks.pagesGo();
    await vi.waitFor(() => expect(news).toHaveBeenCalledWith('left'));
    expect(isSentElsewhere(ID)).toBe(false);
    expect(marksStored()).toEqual([]);
    stop();
  });

  it('are news that changed when another tab writes or removes one', () => {
    const news = vi.fn();
    const stop = onOtherTabsMarks(news);
    window.dispatchEvent(new StorageEvent('storage', { key: `${SAVE_MARKS_STORAGE_KEY}:p:${ID}` }));
    expect(news).toHaveBeenCalledExactlyOnceWith('changed');
    stop();
  });

  it('are news that their tab left when one runs out', async () => {
    vi.useFakeTimers();
    const tab = await otherTab();
    tab.markSending(ID, true);
    const news = vi.fn();
    const stop = onOtherTabsMarks(news);
    vi.advanceTimersByTime(59_999);
    expect(news).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(news).toHaveBeenCalledExactlyOnceWith('left');
    stop();
  });
});
