// In a batch each ticket is already a sub agent, so only a single ticket run gets these.
export function ticketSubAgentLines(maxSubAgents: number | undefined): string[] {
  if (!maxSubAgents || maxSubAgents < 2) return [];
  return [
    '',
    '## Sub agents',
    '- You may use sub agents (the Agent tool) when parts of this ticket can be done at the same time.',
    `- Use at most ${maxSubAgents} sub agents at once.`,
    '- For a small ticket, work alone.',
    '- Give each sub agent its own files. Two sub agents never change the same file.',
    '- When all sub agents end, check the full result yourself and run the tests before you report.',
  ];
}
