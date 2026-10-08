import type { GroupBox, RowBox } from './dropTarget';

function measureRow(row: HTMLElement): RowBox {
  const rect = row.getBoundingClientRect();
  return { id: row.dataset.dropRow ?? '', top: rect.top, height: rect.height };
}

/** Reads the groups (`data-drop-group`) and their visible rows (`data-drop-row`) on screen now. */
export function measureGroups(container: HTMLElement | null): GroupBox[] {
  if (!container) return [];
  const sections = container.querySelectorAll<HTMLElement>('[data-drop-group]');
  return Array.from(sections, (section) => {
    const rect = section.getBoundingClientRect();
    const rows = section.querySelectorAll<HTMLElement>('[data-drop-row]');
    return {
      statusId: section.dataset.dropGroup ?? '',
      top: rect.top,
      bottom: rect.bottom,
      rows: Array.from(rows, measureRow),
    };
  });
}
