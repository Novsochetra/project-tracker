import { describe, expect, it } from 'vitest';
import { registerRunnerInput } from '../src/api/runs';
import { RUNNER_TOOL_NAME_MAX, RUNNER_TOOLS_MAX } from '../src/domain/run';
import { helperLabel, toolNames, toolsText } from '../src/logic/runnerTools';

const TOOLS = { servers: ['GitHub', 'Notion'], commands: ['standup'], skills: ['report'] };

describe('a helper check-in with its tools', () => {
  const checkIn = (tools: unknown) =>
    registerRunnerInput.safeParse({ name: 'Mac', projectKeys: ['MOB'], tools });

  it('takes names, trimmed, and none at all from an older helper', () => {
    expect(checkIn({ servers: [' GitHub '], commands: [], skills: [] }).data?.tools).toEqual({
      servers: ['GitHub'],
      commands: [],
      skills: [],
    });
    expect(checkIn(undefined).data?.tools).toBeUndefined();
  });

  it('refuses lists or names past their bounds, and empty names', () => {
    const many = Array.from({ length: RUNNER_TOOLS_MAX + 1 }, (_, index) => `s${index}`);
    expect(checkIn({ servers: many, commands: [], skills: [] }).success).toBe(false);
    const long = 'x'.repeat(RUNNER_TOOL_NAME_MAX + 1);
    expect(checkIn({ servers: [], commands: [long], skills: [] }).success).toBe(false);
    expect(checkIn({ servers: [], commands: [], skills: ['  '] }).success).toBe(false);
    expect(checkIn({ servers: [] }).success).toBe(false);
  });
});

describe('helper labels', () => {
  it('lists servers, then commands and skills with their slash', () => {
    expect(toolNames(TOOLS)).toEqual(['GitHub', 'Notion', '/standup', '/report']);
    expect(helperLabel({ name: "Dara's MacBook", tools: TOOLS })).toBe(
      "Dara's MacBook · GitHub, Notion, /standup, /report",
    );
  });

  it('names a command and a skill of the same name once', () => {
    expect(toolsText({ servers: [], commands: ['report'], skills: ['report'] })).toBe('/report');
  });

  it('is the name alone without tools', () => {
    expect(helperLabel({ name: 'Mac', tools: null })).toBe('Mac');
    expect(helperLabel({ name: 'Mac', tools: { servers: [], commands: [], skills: [] } })).toBe(
      'Mac',
    );
  });
});
