import { describe, expect, it } from 'vitest';
import { revealGroupTop, scrollBackBy } from './revealGroup';

const box = (top: number) => ({ top }) as DOMRect;

describe('scrollBackBy', () => {
  it('leaves a group whose top is in view where it is', () => {
    expect(scrollBackBy(52, 52)).toBe(0);
    expect(scrollBackBy(300, 52)).toBe(0);
  });

  it('scrolls back to a little below the top of the view', () => {
    expect(scrollBackBy(-900, 52)).toBe(-968);
    expect(scrollBackBy(40, 52)).toBe(-28);
  });
});

describe('revealGroupTop', () => {
  const setup = (groupTop: number) => {
    const scroller = document.createElement('div');
    const group = document.createElement('section');
    scroller.append(group);
    scroller.getBoundingClientRect = () => box(0);
    group.getBoundingClientRect = () => box(groupTop);
    scroller.scrollTop = 1000;
    return { scroller, group };
  };

  it('scrolls the screen back up to a group above the view', () => {
    const { scroller, group } = setup(-400);
    revealGroupTop(group, scroller);
    expect(scroller.scrollTop).toBe(584);
  });

  it('measures from under the nav bar on a phone', () => {
    const { scroller, group } = setup(10);
    const navBar = document.createElement('header');
    navBar.setAttribute('data-navbar', '');
    navBar.getBoundingClientRect = () => ({ bottom: 52 }) as DOMRect;
    scroller.prepend(navBar);
    revealGroupTop(group, scroller);
    expect(scroller.scrollTop).toBe(942);
  });

  it('keeps the scroll when the group is in view', () => {
    const { scroller, group } = setup(120);
    revealGroupTop(group, scroller);
    expect(scroller.scrollTop).toBe(1000);
  });
});
