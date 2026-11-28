import { screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { renderWithApi, sheetTestSetup } from '../../src/app/test/renderWithApi';
import { EMPTY_HEIGHT, LABELS_ROW, label, SHEET, stubLayout } from './labelMenuLayout';
import { NewTicketLabels } from './NewTicketLabels';

// PT-286: in a project without labels, New ticket's label picker (1280×800) hung past the bottom of
// the sheet, over the dimmed page, and its empty state was cut: the menu's height was guessed from
// a count of rows (82px). The menu is now measured, and placed inside the sheet: above its row,
// the last one, and with many labels shrunk to the sheet rather than over its title.

let restore: Array<() => void> = [];

beforeEach(() => {
  restore = [sheetTestSetup(), stubLayout()];
});

afterEach(() => restore.forEach((undo) => undo()));

const menu = () => screen.getByRole('dialog', { name: 'Pick labels' });
const frameTop = () => parseFloat(menu().parentElement!.style.top);

describe('regression: the label picker opens inside its sheet, as tall as what it holds', () => {
  it('opens above the last row with room for its whole empty state', () => {
    renderWithApi(<NewTicketLabels labels={[]} />);
    expect(menu().dataset.up).toBe('true');
    expect(parseFloat(menu().style.maxHeight)).toBeGreaterThanOrEqual(EMPTY_HEIGHT);
    expect(frameTop()).toBe(LABELS_ROW.top - 4 - EMPTY_HEIGHT);
    expect(frameTop()).toBeGreaterThanOrEqual(SHEET.top);
  });

  it('with many labels, keeps 6px inside the sheet’s top and scrolls them', () => {
    const many = Array.from({ length: 30 }, (_, index) => label(`l-${index}`, `L${index}`, index));
    renderWithApi(<NewTicketLabels labels={many} />);
    expect(menu().dataset.up).toBe('true');
    expect(frameTop()).toBe(SHEET.top + 6);
    expect(frameTop() + menu().offsetHeight).toBeLessThanOrEqual(LABELS_ROW.top);
  });
});
