import { describe, expect, it } from 'vitest';
import { DEFAULT_STATUSES, STATUS_CATEGORY_LABELS } from '../../src/domain/status';

describe('regression: category labels use the same words as the default statuses', () => {
  it.each(DEFAULT_STATUSES)('$category is labelled $name', ({ name, category }) => {
    expect(STATUS_CATEGORY_LABELS[category]).toBe(name);
  });
});
