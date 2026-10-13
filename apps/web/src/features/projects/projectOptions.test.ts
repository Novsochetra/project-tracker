import { describe, expect, it } from 'vitest';
import { deletedToast, deleteMenuMessage, deleteSheetCaption } from './projectOptions';

describe('delete confirmations', () => {
  it('counts the tickets in the menu confirm', () => {
    expect(deleteMenuMessage(7)).toBe(
      "Delete this project and its 7 tickets? This can't be undone.",
    );
    expect(deleteMenuMessage(1)).toBe(
      "Delete this project and its 1 ticket? This can't be undone.",
    );
  });

  it('names the project in the action sheet caption', () => {
    expect(deleteSheetCaption('Mobile app', 0)).toBe(
      "Delete “Mobile app” and its 0 tickets? This can't be undone.",
    );
  });

  it('quotes the name in the toast', () => {
    expect(deletedToast('Website')).toBe('“Website” deleted');
  });
});
