import { describe, expect, it } from 'vitest';
import { parseActor } from '../../src/http/actor';

describe('parseActor', () => {
  it('defaults to the person', () => {
    expect(parseActor(undefined, undefined)).toEqual({ kind: 'human', name: '' });
    expect(parseActor('robot', 'x')).toEqual({ kind: 'human', name: 'x' });
  });

  it('names agents, falling back to "Agent"', () => {
    expect(parseActor('agent', undefined)).toEqual({ kind: 'agent', name: 'Agent' });
    expect(parseActor(' Agent ', '   ')).toEqual({ kind: 'agent', name: 'Agent' });
    expect(parseActor('agent', 'Claude%20Code')).toEqual({ kind: 'agent', name: 'Claude Code' });
  });

  it('trims, limits to 60 characters and tolerates bad encoding', () => {
    expect(parseActor('agent', `  ${'a'.repeat(70)}  `).name).toHaveLength(60);
    expect(parseActor('human', '%E0%A4%A')).toEqual({ kind: 'human', name: '%E0%A4%A' });
  });

  it('drops a NUL, as stored text does', () => {
    expect(parseActor('agent', 'Claude%00%20Worker')).toEqual({
      kind: 'agent',
      name: 'Claude Worker',
    });
  });
});
