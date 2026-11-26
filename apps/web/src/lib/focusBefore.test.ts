import { afterEach, describe, expect, it } from 'vitest';
import { focusBefore } from './focusBefore';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('focusBefore', () => {
  it('focuses the closest focusable element before the one leaving, on its screen', () => {
    document.body.innerHTML = `
      <nav><button>Sidebar</button></nav>
      <div data-stack-scroller>
        <button>Mobile app</button>
        <a href="/p/WEB">Website</a>
        <button disabled>Not now</button>
        <section id="card"><button>Move 3 to Done</button></section>
        <button>After the card</button>
      </div>`;
    focusBefore(document.getElementById('card')!);
    expect(document.activeElement).toHaveTextContent('Website');
  });

  it('leaves focus alone when nothing before it can take it', () => {
    document.body.innerHTML = `
      <button>Sidebar</button>
      <div data-stack-scroller><section id="card"><button>Move</button></section></div>`;
    const inside = document.querySelector<HTMLButtonElement>('#card button')!;
    inside.focus();
    focusBefore(document.getElementById('card')!);
    expect(document.activeElement).toBe(inside);
  });
});
