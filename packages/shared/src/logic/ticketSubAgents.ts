// In a batch each ticket is already a sub agent, so only a single ticket run gets these.
export function ticketSubAgentLines(): string[] {
  return [
    '',
    '## Sub agents',
    '- You may use sub agents (the Agent tool) when parts of this ticket can be done at the same time.',
    "- Decide how many to use, and follow the repo's CLAUDE.md for any limit.",
    '- For a small ticket, work alone.',
    '- Give each sub agent its own files. Two sub agents never change the same file.',
    '- When all sub agents end, check the full result yourself and run the tests before you report.',
  ];
}
