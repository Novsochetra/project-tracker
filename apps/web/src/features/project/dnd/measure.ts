import { dropGroupId, dropGroupsIn } from './dropGroup';
import { dropRowId, dropRowsIn } from './dropRow';
import type { GroupBox, RowBox } from './dropTarget';

function measureRow(row: HTMLElement): RowBox {
  const rect = row.getBoundingClientRect();
  return { id: dropRowId(row), top: rect.top, height: rect.height };
}

export function measureGroups(container: HTMLElement | null): GroupBox[] {
  if (!container) return [];
  return dropGroupsIn(container).map((section) => {
    const rect = section.getBoundingClientRect();
    const rows = dropRowsIn(section);
    return {
      statusId: dropGroupId(section),
      top: rect.top,
      bottom: rect.bottom,
      left: rect.left,
      right: rect.right,
      rows: rows.map(measureRow),
    };
  });
}
