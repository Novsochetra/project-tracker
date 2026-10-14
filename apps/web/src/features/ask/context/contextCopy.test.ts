import { describe, expect, it } from 'vitest';
import { chatTokensText, contextLabel, contextUsedText } from './contextCopy';

describe('context copy', () => {
  it('says how full the context is, and what the chat used', () => {
    expect(contextLabel(70)).toBe('Context 70%');
    expect(contextUsedText({ used: 140_000, window: 200_000 })).toBe(
      "140,000 of 200,000 tokens in Claude's context",
    );
    expect(chatTokensText(1_240_000)).toBe('This chat used 1,240,000 tokens in all');
    expect(chatTokensText(1)).toBe('This chat used 1 token in all');
  });
});
