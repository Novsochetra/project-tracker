import { afterEach, describe, expect, it } from 'vitest';
import { controlsAfter, focusFirst } from './focusFirst';

afterEach(() => {
  document.body.replaceChildren();
});

function page(html: string) {
  document.body.innerHTML = html;
  return document.getElementById('note')!;
}

const names = (controls: readonly HTMLElement[]) => controls.map((control) => control.textContent);

describe('controlsAfter', () => {
  it('lists the controls after the element, not those inside it or before it', () => {
    const note = page(`
      <button>Before</button>
      <div id="note"><button>Dismiss</button></div>
      <button>Attach files</button>
      <video tabindex="-1"></video>
      <a href="/next">Next</a>
    `);
    expect(names(controlsAfter(note))).toEqual(['Attach files', 'Next']);
  });
});

describe('focusFirst', () => {
  it('focuses the first control that takes focus', () => {
    const note = page(`
      <div id="note"><button>Dismiss</button></div>
      <button disabled>Comment</button>
      <a href="/next">Next</a>
    `);
    focusFirst([null, ...controlsAfter(note)]);
    expect(document.activeElement?.textContent).toBe('Next');
  });

  it('passes over a control that has left the page', () => {
    const note = page(`<div id="note"></div><button>Gone</button><button>Kept</button>`);
    const controls = controlsAfter(note);
    controls[0]!.remove();
    focusFirst(controls);
    expect(document.activeElement?.textContent).toBe('Kept');
  });

  it('leaves focus alone when none takes it', () => {
    focusFirst([undefined, null]);
    expect(document.activeElement).toBe(document.body);
  });
});
