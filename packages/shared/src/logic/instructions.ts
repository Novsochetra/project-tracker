export interface PromptInstructions {
  instructions?: string;
}

export interface PromptLabel {
  name: string;
  instructions: string;
}

const block = (heading: string, text: string | undefined): string[] => {
  const trimmed = text?.trim();
  return trimmed ? [heading, trimmed] : [];
};

// One block for every prompt: the project's instructions, then those of the ticket's labels.
export function instructionsBlock(
  project: PromptInstructions,
  heading: string,
  labels: readonly PromptLabel[] = [],
): string[] {
  const blocks = [
    block(`${heading} Project instructions`, project.instructions),
    ...labels.map((label) =>
      block(`${heading} Instructions for "${label.name}" tickets`, label.instructions),
    ),
  ].filter((lines) => lines.length > 0);
  return blocks.flatMap((lines, index) => (index === 0 ? lines : ['', ...lines]));
}

// Once each, in the order they come, for a prompt that holds several tickets.
export function distinctLabels(
  tickets: readonly { labels?: readonly PromptLabel[] | undefined }[],
): PromptLabel[] {
  const seen = new Map<string, PromptLabel>();
  for (const label of tickets.flatMap((ticket) => ticket.labels ?? [])) {
    if (!seen.has(label.name)) seen.set(label.name, label);
  }
  return [...seen.values()];
}
