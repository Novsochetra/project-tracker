import { afterEach, describe, expect, it } from 'vitest';
import { focusAfter } from './focusAfter';

afterEach(() => {
  document.body.replaceChildren();
});

function page(html: string) {
  document.body.innerHTML = html;
  return document.getElementById('note')!;
}

describe('focusAfter', () => {
  it('focuses the first control after the element, not one inside it or before it', () => {
    const note = page(`
      <button>Before</button>
      <div id="note"><button>Dismiss</button></div>
      <button>Attach files</button>
      <button>Comment</button>
    `);
    focusAfter(note);
    expect(document.activeElement?.textContent).toBe('Attach files');
  });

  it('passes over controls that take no focus', () => {
    const note = page(`
      <div id="note"><button>Dismiss</button></div>
      <button disabled>Comment</button>
      <video tabindex="-1"></video>
      <a href="/next">Next</a>
    `);
    focusAfter(note);
    expect(document.activeElement?.textContent).toBe('Next');
  });

  it('leaves focus alone when nothing after the element takes it', () => {
    const note = page(`<button>Before</button><div id="note"><button>Dismiss</button></div>`);
    focusAfter(note);
    expect(document.activeElement).toBe(document.body);
  });
});
