import { describe, expect, it } from 'vitest';
import { permissionLabel } from '../../src/logic/runRequests/permissionLabel';

// An array under a secret's name showed in full ('password: ["hunter2"]'), while the same value
// in an object was masked (PT-171 review).
const lineOf = (input: Record<string, unknown>) =>
  permissionLabel('mcp__db__connect', input, '/r').label.split('\n')[1];

describe('an array under a secret name', () => {
  it('masks each element that is one literal word', () => {
    expect(lineOf({ password: ['hunter2'] })).toBe('password: ["***"]');
    expect(lineOf({ api_key: ['abc', 'def', 12345] })).toBe('api_key: ["***","***",***]');
    expect(lineOf({ token: [['abc'], []] })).toBe('token: [["***"],[]]');
  });

  it('keeps what is not one literal word, and an array under another name', () => {
    expect(lineOf({ token: ['two words', true, null] })).toBe('token: ["two words",true,null]');
    expect(lineOf({ labels: ['bug', 'ui'] })).toBe('labels: ["bug","ui"]');
  });
});
