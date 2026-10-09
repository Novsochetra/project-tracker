import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CreatedApiToken } from '@tracker/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithApi, sheetTestSetup } from '../../src/features/claude/test/renderWithApi';
import { TokensSection } from '../../src/features/connect/TokensSection';
import { PHONE_QUERY, REDUCED_MOTION_QUERY } from '../../src/lib/media';

// The reviewer of PT-125: on a phone (375x812) the card with a new token opens below the fold of
// the Connect sheet. Focus moved to it without scrolling, so only its title showed, not the token
// or Copy, until the person scrolled.

const created: CreatedApiToken = {
  token: { id: 'tok1', name: 'Work Mac', hint: 'trk_9f8e', createdAt: 0, lastUsedAt: null },
  secret: 'trk_9f8e7d6c5b4a39281706f5e4d3c2b1a0',
};

let restore: () => void;
const scrolled = vi.fn();

function mockMedia(matching: readonly string[]): () => void {
  const previous = Object.getOwnPropertyDescriptor(window, 'matchMedia');
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: matching.includes(query),
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
  });
  return () => {
    if (previous) Object.defineProperty(window, 'matchMedia', previous);
    else Reflect.deleteProperty(window, 'matchMedia');
  };
}

beforeEach(() => {
  restore = sheetTestSetup(true);
  scrolled.mockClear();
  Element.prototype.scrollIntoView = scrolled;
});

afterEach(() => {
  restore();
  Reflect.deleteProperty(Element.prototype, 'scrollIntoView');
});

async function createToken() {
  renderWithApi(<TokensSection />, {
    listApiTokens: vi.fn().mockResolvedValue([]),
    createApiToken: vi.fn().mockResolvedValue(created),
  });
  const user = userEvent.setup();
  await user.type(await screen.findByRole('textbox', { name: 'Token name' }), 'Work Mac{Enter}');
  return screen.findByRole('group', { name: 'New token Work Mac' });
}

describe('regression: the new token card on a phone', () => {
  it('scrolls the whole card into view and keeps focus on it', async () => {
    const card = await createToken();
    expect(card).toHaveFocus();
    expect(scrolled).toHaveBeenCalledWith({ block: 'nearest', behavior: 'smooth' });
    expect(scrolled.mock.contexts).toEqual([card]);
  });

  it('jumps without motion when motion is reduced', async () => {
    const restoreMedia = mockMedia([PHONE_QUERY, REDUCED_MOTION_QUERY]);
    try {
      await createToken();
      expect(scrolled).toHaveBeenCalledWith({ block: 'nearest', behavior: 'instant' });
    } finally {
      restoreMedia();
    }
  });
});
