import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { renderWithApi, sheetTestSetup } from '../../src/app/test/renderWithApi';
import { fieldTop, label, stubLayout } from './labelMenuLayout';
import { NewTicketLabels } from './NewTicketLabels';

// PT-286 review: a label picker above its row kept its bottom by the row, with the field at its
// top, so the field jumped as typing changed the rows: 54px down on the first key in a project
// without labels, and from the top of the screen to the row with 15. The field now comes last
// above the row, and the menu grows and shrinks away from it.

let restore: Array<() => void> = [];

beforeEach(() => {
  restore = [sheetTestSetup(), stubLayout()];
});

afterEach(() => restore.forEach((undo) => undo()));

const menu = () => screen.getByRole('dialog', { name: 'Pick labels' });

// jsdom has no ResizeObserver, so the menu is placed again as the browser would on its new size.
const relayout = () => act(() => void window.dispatchEvent(new Event('resize')));

async function typeAndRelayout(text: string) {
  await userEvent.keyboard(text);
  relayout();
}

describe('regression: the label picker’s field stays put while typing', () => {
  it('in a project without labels', async () => {
    renderWithApi(<NewTicketLabels labels={[]} />);
    relayout();
    const opened = fieldTop(menu());
    await typeAndRelayout('v');
    expect(fieldTop(menu())).toBe(opened);
    await typeAndRelayout('1.4');
    expect(fieldTop(menu())).toBe(opened);
  });

  it('with many labels, narrowed and cleared again', async () => {
    const many = Array.from({ length: 15 }, (_, index) => label(`l-${index}`, `L${index}`, index));
    renderWithApi(<NewTicketLabels labels={many} />);
    relayout();
    const opened = fieldTop(menu());
    await typeAndRelayout('v1.9');
    expect(fieldTop(menu())).toBe(opened);
    await typeAndRelayout('{Backspace}{Backspace}{Backspace}{Backspace}');
    expect(fieldTop(menu())).toBe(opened);
  });
});
