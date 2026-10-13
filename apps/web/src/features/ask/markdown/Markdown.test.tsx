import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Markdown } from './Markdown';

const ANSWER = [
  '# Sync plan',
  'Captures **wait** in a *queue*. See [the docs](https://x.dev/docs) or https://x.dev/faq.',
  '## Steps',
  '1. Batch them\n2. Send with `fetch`',
  '- a\n- b',
  '> Note: keep drafts.',
  '```ts\nconst queue = [];\n```',
  '| File | Lines |\n|---|--:|\n| sync.ts | 120 |',
  '---',
].join('\n\n');

describe('Markdown', () => {
  it('shows headings, emphasis, links, lists, quotes, code and tables', () => {
    const { container } = render(<Markdown text={ANSWER} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Sync plan' })).toBeVisible();
    expect(screen.getByRole('heading', { level: 2, name: 'Steps' })).toBeVisible();
    expect(screen.getByText('wait').tagName).toBe('STRONG');
    expect(screen.getByText('queue').tagName).toBe('EM');
    const [numbered, bullets] = screen.getAllByRole('list');
    expect(numbered!.tagName).toBe('OL');
    expect(within(numbered!).getAllByRole('listitem')).toHaveLength(2);
    expect(within(numbered!).getByText('fetch').tagName).toBe('CODE');
    expect(within(bullets!).getAllByRole('listitem')).toHaveLength(2);
    expect(container.querySelector('blockquote')).toHaveTextContent('Note: keep drafts.');
    expect(container.querySelector('pre')).toHaveTextContent('const queue = [];');
    expect(screen.getByRole('columnheader', { name: 'Lines' })).toHaveStyle({
      textAlign: 'right',
    });
    expect(screen.getByRole('cell', { name: 'sync.ts' })).toBeVisible();
    expect(screen.getByRole('separator')).toBeVisible();
  });

  it('opens links in a new tab without the page', () => {
    render(<Markdown text={ANSWER} />);
    for (const link of screen.getAllByRole('link')) {
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    }
    expect(screen.getByRole('link', { name: 'the docs' })).toHaveAttribute(
      'href',
      'https://x.dev/docs',
    );
  });

  it('shows HTML in an answer as text', () => {
    const html = '<script>window.hacked = 1</script>\n\n<img src=x onerror="window.hacked = 1">';
    const { container } = render(<Markdown text={`${html}\n\n| <b>x</b> |\n|---|`} />);
    expect(container.querySelector('script, img, b')).toBeNull();
    expect(container).toHaveTextContent('<script>window.hacked = 1</script>');
    expect(container).toHaveTextContent('<img src=x onerror="window.hacked = 1">');
    expect(screen.getByRole('columnheader', { name: '<b>x</b>' })).toBeVisible();
  });

  it('never links an address that is not on the web', () => {
    render(<Markdown text="[run](javascript:alert(1)) [file](file:///etc/passwd)" />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('shows nothing for an empty answer', () => {
    const { container } = render(<Markdown text={'\n  \n'} />);
    expect(container).toBeEmptyDOMElement();
  });

  // The parse is timed in parseMarkdown.timing.test.ts and the page in e2e/ask-markdown.spec.ts:
  // jsdom takes seconds for what a browser lays out in a fraction of one.
  it('shows a 100,000-character answer whole', () => {
    const answer = `${ANSWER}\n\n`
      .repeat(Math.ceil(100_000 / (ANSWER.length + 2)))
      .slice(0, 100_000);
    const { container } = render(<Markdown text={answer} />);
    expect(container.querySelectorAll('table').length).toBeGreaterThan(100);
  });
});
