import { afterEach, describe, expect, it } from 'vitest';
import { listItem, project, STATUS, statuses } from '../../api/test/fixtures';
import { focusAfterMoveAll } from './readyFocus';
import { readyItems } from './readyItems';

const items = (nums: number[]) =>
  readyItems({ tickets: nums.map((num) => listItem(num, STATUS.reviewed, 0)), statuses }, [
    project,
  ]);

function screenWithCard(rows: number[]): HTMLElement {
  document.body.innerHTML = `
    <div data-stack-scroller>
      <button>Mobile app</button>
      <section id="card">
        <button id="move">Move all</button>
        ${rows.map((num) => `<div data-ready-row="MOB-${num}"><button>MOB-${num}</button></div>`).join('')}
      </section>
    </div>`;
  document.getElementById('move')!.focus();

  return document.getElementById('card')!;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('focusAfterMoveAll', () => {
  it('hands focus to what is above a card whose every ticket moves', () => {
    const card = screenWithCard([1, 2]);
    focusAfterMoveAll(card, items([1, 2]), { keys: ['MOB-1', 'MOB-2'], doneName: 'Done' });
    expect(document.activeElement).toHaveTextContent('Mobile app');
  });

  it('leaves focus on the button while two or more tickets stay to move', () => {
    const card = screenWithCard([1, 2, 3, 4]);
    focusAfterMoveAll(card, items([1, 2, 3, 4]), { keys: ['MOB-1', 'MOB-2'], doneName: 'Done' });
    expect(document.activeElement).toHaveTextContent('Move all');
  });

  it('moves focus to the first ticket that stays once no button is left', () => {
    const card = screenWithCard([1, 2, 3]);
    focusAfterMoveAll(card, items([1, 2, 3]), { keys: ['MOB-1', 'MOB-2'], doneName: 'Done' });
    expect(document.activeElement).toHaveTextContent('MOB-3');
  });
});
