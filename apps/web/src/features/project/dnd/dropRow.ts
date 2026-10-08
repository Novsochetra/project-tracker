export const DROP_ROW_ATTRIBUTE = 'data-drop-row';

export const dropRowOf = (element: Element | null | undefined): HTMLElement | null =>
  element?.closest<HTMLElement>(`[${DROP_ROW_ATTRIBUTE}]`) ?? null;

export const dropRowsIn = (root: ParentNode): HTMLElement[] =>
  Array.from(root.querySelectorAll<HTMLElement>(`[${DROP_ROW_ATTRIBUTE}]`));

export const dropRowId = (row: Element): string => row.getAttribute(DROP_ROW_ATTRIBUTE) ?? '';
