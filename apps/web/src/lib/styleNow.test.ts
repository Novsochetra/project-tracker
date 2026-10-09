import { afterEach, expect, it, vi } from 'vitest';
import { styleNow } from './styleNow';

afterEach(() => {
  vi.restoreAllMocks();
});

it('asks for the box of the element put in', () => {
  const boxes = vi.spyOn(Element.prototype, 'getBoundingClientRect');
  const element = document.createElement('div');
  styleNow(element);
  expect(boxes.mock.contexts).toEqual([element]);
});

it('does nothing as the element goes', () => {
  const boxes = vi.spyOn(Element.prototype, 'getBoundingClientRect');
  styleNow(null);
  expect(boxes).not.toHaveBeenCalled();
});
