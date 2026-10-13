export interface PromptInstructions {
  instructions?: string;
}

// One block for every prompt, so instructions from more places can join it later.
export function instructionsBlock(project: PromptInstructions, heading: string): string[] {
  const text = project.instructions?.trim();
  return text ? [`${heading} Project instructions`, text] : [];
}
