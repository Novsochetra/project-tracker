import { describe, expect, it } from 'vitest';
import { approvalsProblem, runPermissionMode } from '../../src/watch/approvals';

describe('--approvals', () => {
  it('makes ticket runs ask before each step when the person chose no mode', () => {
    expect(runPermissionMode({ approvals: true })).toBe('default');
    expect(runPermissionMode({})).toBeUndefined();
  });

  it("keeps the person's own mode", () => {
    expect(runPermissionMode({ approvals: true, permissionMode: 'acceptEdits' })).toBe(
      'acceptEdits',
    );
    expect(runPermissionMode({ permissionMode: 'auto' })).toBe('auto');
  });

  it('refuses a mode that never asks', () => {
    for (const permissionMode of ['bypassPermissions', 'dontAsk']) {
      expect(approvalsProblem({ approvals: true, permissionMode })).toBe(
        `--approvals asks on the phone, but --permission-mode ${permissionMode} never asks. Use acceptEdits.`,
      );
      expect(approvalsProblem({ permissionMode })).toBeUndefined();
    }
    expect(approvalsProblem({ approvals: true, permissionMode: 'acceptEdits' })).toBeUndefined();
    expect(approvalsProblem({ approvals: true })).toBeUndefined();
  });
});
