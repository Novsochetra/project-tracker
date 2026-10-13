import { describe, expect, it } from 'vitest';
import { ASK_PERSON_CALL_MS, claudeEnv } from '../../src/watch/claudeEnv';

describe('claudeEnv', () => {
  it("leaves Claude Code's own tool timeout, and a longer one, alone", () => {
    const env = { PATH: '/bin' };
    expect(claudeEnv(env)).toBe(env);
    expect(claudeEnv({ MCP_TOOL_TIMEOUT: String(ASK_PERSON_CALL_MS * 2) }).MCP_TOOL_TIMEOUT).toBe(
      String(ASK_PERSON_CALL_MS * 2),
    );
    expect(claudeEnv({ MCP_TOOL_TIMEOUT: 'soon' }).MCP_TOOL_TIMEOUT).toBe('soon');
  });

  it('raises a shorter tool timeout past what ask_person waits', () => {
    const env = claudeEnv({ PATH: '/bin', MCP_TOOL_TIMEOUT: '60000' });
    expect(env).toEqual({ PATH: '/bin', MCP_TOOL_TIMEOUT: String(ASK_PERSON_CALL_MS) });
    expect(ASK_PERSON_CALL_MS).toBeGreaterThan(31 * 60_000);
  });
});
