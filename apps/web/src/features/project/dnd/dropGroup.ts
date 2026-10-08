export const DROP_GROUP_ATTRIBUTE = 'data-drop-group';

export const dropGroupsIn = (root: ParentNode): HTMLElement[] =>
  Array.from(root.querySelectorAll<HTMLElement>(`[${DROP_GROUP_ATTRIBUTE}]`));

export const dropGroupId = (group: Element): string =>
  group.getAttribute(DROP_GROUP_ATTRIBUTE) ?? '';
