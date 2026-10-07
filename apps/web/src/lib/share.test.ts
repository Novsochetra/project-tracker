import { afterEach, describe, expect, it, vi } from 'vitest';
import { canShare, PROMPT_SHARE_TITLE, sharePrompt } from './share';

function setShare(value: Navigator['share'] | undefined) {
  Object.defineProperty(navigator, 'share', { value, configurable: true });
}

describe('sharePrompt', () => {
  afterEach(() => {
    setShare(undefined);
  });

  it('is unavailable without navigator.share', async () => {
    setShare(undefined);
    expect(canShare()).toBe(false);
    await expect(sharePrompt('Prompt')).resolves.toBe(false);
  });

  it('shares the prompt with its title', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    setShare(share);
    expect(canShare()).toBe(true);
    await expect(sharePrompt('Prompt')).resolves.toBe(true);
    expect(share).toHaveBeenCalledWith({ title: PROMPT_SHARE_TITLE, text: 'Prompt' });
    expect(PROMPT_SHARE_TITLE).toBe('Prompt for Claude Code');
  });

  it('returns false when the share sheet is dismissed or fails', async () => {
    setShare(vi.fn().mockRejectedValue(new DOMException('', 'AbortError')));
    await expect(sharePrompt('Prompt')).resolves.toBe(false);
  });
});
