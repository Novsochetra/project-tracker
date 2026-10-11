import { describe, expect, it } from 'vitest';
import { RUN_PERMISSION_LABEL_MAX } from '../../src/domain/runRequest';
import { permissionLabel } from '../../src/logic/runRequests/permissionLabel';

// A 15 MB call with a million keys was formatted whole before the label was cut, which held the
// helper's event loop for seconds (PT-171 review). Only what can show is read now.
describe('a huge MCP call', () => {
  it('reads only the arguments that can show, and is cut', () => {
    let reads = 0;
    const input: Record<string, unknown> = {};
    for (let index = 0; index < 100_000; index += 1) {
      Object.defineProperty(input, `secret_token_${index}`, {
        enumerable: true,
        get: () => {
          reads += 1;
          return 'value';
        },
      });
    }
    const { label, cut } = permissionLabel('mcp__db__query', input, '/r');
    expect(cut).toBe(true);
    expect(label.length).toBe(RUN_PERMISSION_LABEL_MAX);
    expect(reads).toBeLessThan(1000);
  });
});
