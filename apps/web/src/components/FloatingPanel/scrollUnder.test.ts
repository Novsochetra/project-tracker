import { afterEach, describe, expect, it, vi } from 'vitest';
import { canScroll, scrollerFor, scrollUnder } from './scrollUnder';

function box(overflow: string, size: { height: number; content: number; top?: number }) {
  const element = document.createElement('div');
  element.style.overflowY = overflow;
  Object.defineProperty(element, 'clientHeight', { value: size.height });
  Object.defineProperty(element, 'scrollHeight', { value: size.content });
  element.scrollTop = size.top ?? 0;
  return element;
}

const wheel = (deltaY: number, deltaMode = 0) => ({
  deltaX: 0,
  deltaY,
  deltaMode,
  clientX: 40,
  clientY: 60,
});

// jsdom has no layout, so it has no elementsFromPoint either.
function stubElementsAt(elements: Element[]) {
  const at = vi.fn().mockReturnValue(elements);
  Object.defineProperty(document, 'elementsFromPoint', { configurable: true, value: at });
  return at;
}

afterEach(() => {
  document.body.replaceChildren();
  Reflect.deleteProperty(document, 'elementsFromPoint');
});

describe('canScroll', () => {
  it('needs overflow auto or scroll and room left that way', () => {
    const list = box('auto', { height: 100, content: 300, top: 0 });
    document.body.append(list);
    expect(canScroll(list, 0, 40)).toBe(true);
    expect(canScroll(list, 0, -40)).toBe(false);
    expect(canScroll(list, 0, 0)).toBe(false);
    const visible = box('visible', { height: 100, content: 300 });
    document.body.append(visible);
    expect(canScroll(visible, 0, 40)).toBe(false);
  });

  it('stops at the end', () => {
    const list = box('scroll', { height: 100, content: 300, top: 200 });
    document.body.append(list);
    expect(canScroll(list, 0, 40)).toBe(false);
    expect(canScroll(list, 0, -40)).toBe(true);
  });
});

describe('scrollerFor', () => {
  it('finds the nearest area that can scroll that way', () => {
    const outer = box('auto', { height: 100, content: 300 });
    const inner = box('auto', { height: 100, content: 100 });
    const row = document.createElement('p');
    inner.append(row);
    outer.append(inner);
    document.body.append(outer);
    expect(scrollerFor(row, 0, 40)).toBe(outer);
    expect(scrollerFor(undefined, 0, 40)).toBeNull();
  });
});

describe('scrollUnder', () => {
  it('scrolls the area under the layer by the wheel', () => {
    const list = box('auto', { height: 200, content: 900 });
    const row = document.createElement('p');
    list.append(row);
    const layer = document.createElement('button');
    document.body.append(list, layer);
    list.scrollBy = vi.fn();
    const at = stubElementsAt([layer, row, list, document.body]);
    scrollUnder(layer, wheel(2, 1));
    expect(at).toHaveBeenCalledWith(40, 60);
    expect(list.scrollBy).toHaveBeenCalledWith({ left: 0, top: 32 });
  });

  it('does nothing when nothing under it scrolls', () => {
    const layer = document.createElement('button');
    document.body.append(layer);
    stubElementsAt([layer, document.body]);
    expect(() => scrollUnder(layer, wheel(100))).not.toThrow();
  });
});
