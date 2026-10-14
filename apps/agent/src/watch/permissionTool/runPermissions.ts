import { laneOf, type Run } from '@tracker/shared';
import { trackerAllowedArgs } from '../mcp/trackerAllowedTools';
import { questionsOnly } from './questionsOnly';
import type { PromptTool } from './withPromptTool';

export interface RunPermissions {
  allowed: string[];
  tool: PromptTool | undefined;
}

// Every run may ask the person (PT-230). Only runs of the ticket lane, the ones that may change
// the folder, get the tracker tools and may ask for a permission; an Ask or Plan question may only
// ask questions, so no answer can widen what it may do.
export function runPermissions(run: Run, prompts: PromptTool | undefined): RunPermissions {
  const changesFolder = laneOf(run.kind, run.askOptions) === 'ticket';
  const tool = prompts && (changesFolder ? prompts : questionsOnly(prompts));
  return { allowed: changesFolder ? trackerAllowedArgs(run) : [], tool };
}
