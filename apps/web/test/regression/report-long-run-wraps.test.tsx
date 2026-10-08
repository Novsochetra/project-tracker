import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { statuses } from '../../src/api/test/fixtures';
import { ReportBody } from '../../src/features/ticket/activity/ReportBody';

// Reviewer 32 (PT-55): a report whose SUMMARY held 90,000 closing brackets made the screen scroll
// sideways by 88px at 375 in WebKit, while 20,000 wrapped. WebKit lays out one text node with a
// run that long wider than its box; the same text in nodes of 10,000 characters wraps.
const LONGEST_NODE = 10_000;

const textNodes = (root: Node): string[] => {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: string[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode())
    nodes.push(node.nodeValue ?? '');
  return nodes;
};

const graphemeStarts = (text: string): Set<number> =>
  new Set(
    Array.from(
      new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text),
      (part) => part.index,
    ),
  );

afterEach(() => vi.restoreAllMocks());

describe('regression: a very long run in a report wraps', () => {
  it.each([
    ['a summary of 90,000 brackets', `SUMMARY: ${')'.repeat(90_000)}`, ')'.repeat(90_000)],
    [
      'a link followed by brackets',
      `SUMMARY: https://x.dev/${')'.repeat(90_000)}`,
      ')'.repeat(90_000),
    ],
    ['raw text without sections', 'W'.repeat(95_000), 'W'.repeat(95_000)],
  ])('shows %s in text nodes short enough to wrap', (_, report, run) => {
    const error = vi.spyOn(console, 'error');
    const { container } = render(<ReportBody text={report} statuses={statuses} />);
    const nodes = textNodes(container);
    expect(Math.max(...nodes.map((node) => node.length))).toBeLessThanOrEqual(LONGEST_NODE);
    expect(container.textContent).toContain(run);
    expect(error).not.toHaveBeenCalled();
  });

  it('splits between graphemes, so no letter loses its accent or emoji its parts', () => {
    const accented = 'é';
    const family = '👩‍👩‍👧';
    const text = `${accented.repeat(7_001)}${family.repeat(3_001)}`;
    const { container } = render(<ReportBody text={text} statuses={statuses} />);
    const nodes = textNodes(container);
    expect(nodes.join('')).toBe(text);
    const starts = graphemeStarts(text);
    let offset = 0;
    for (const node of nodes) {
      expect(starts.has(offset)).toBe(true);
      offset += node.length;
    }
    expect(nodes.length).toBeGreaterThan(1);
  });

  it('keeps ordinary text in one node', () => {
    const { container } = render(<ReportBody text="SUMMARY: Fixed it." statuses={statuses} />);
    expect(textNodes(container.querySelector('dd')!)).toEqual(['Fixed it.']);
  });
});
