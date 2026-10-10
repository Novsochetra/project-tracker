import { afterEach, describe, expect, it, vi } from 'vitest';
import { fakeLocks } from '../test/fakeLocks';
import { holdPageLock, whenPageGone } from './pageLocks';

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('a page’s lock', () => {
  let restore = () => undefined as void;

  afterEach(() => restore());

  it('tells another tab once the page has gone, not before', async () => {
    const locks = fakeLocks();
    restore = locks.restore;
    holdPageLock('open-page');
    const gone = vi.fn();
    whenPageGone('open-page', gone);
    await settle();
    expect(gone).not.toHaveBeenCalled();

    locks.pagesGo();
    await vi.waitFor(() => expect(gone).toHaveBeenCalledTimes(1));
  });

  it('tells at once of a page that went before anyone asked', async () => {
    restore = fakeLocks().restore;
    const gone = vi.fn();
    whenPageGone('page-gone-already', gone);
    await vi.waitFor(() => expect(gone).toHaveBeenCalledTimes(1));
  });

  it('is asked for once per page', async () => {
    restore = fakeLocks().restore;
    const gone = vi.fn();
    whenPageGone('page-asked-twice', gone);
    whenPageGone('page-asked-twice', gone);
    await settle();
    expect(gone).toHaveBeenCalledTimes(1);
  });

  it('tells nothing without Web Locks, and holds nothing', async () => {
    const gone = vi.fn();
    holdPageLock('page-without-locks');
    whenPageGone('page-without-locks', gone);
    await settle();
    expect(gone).not.toHaveBeenCalled();
  });
});
