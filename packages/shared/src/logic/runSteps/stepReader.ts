import type { RunStepInput } from '../../domain/runStep';
import { answeredToolIds, deniedToolIds } from './denials';
import { isJson, type Json } from '../json';
import { stepLabel, messageSteps } from './messageSteps';

// Reads one run's claude -p --output-format stream-json --verbose, an event at a time. Only what
// Claude says, the tools it asks for and the calls that were not allowed become steps: tool
// results, thinking and the result event never leave the computer. It remembers the calls still
// open, since a refusal names only the call's id.
export function createStepReader(folder: string): (event: unknown) => RunStepInput[] {
  const open = new Map<string, RunStepInput>();

  function denied(event: Json): RunStepInput[] {
    return deniedToolIds(event).flatMap((toolId) => {
      const asked = open.get(toolId);
      open.delete(toolId);
      if (!asked) return [];
      const label = stepLabel(`Not allowed: ${asked.label}`);
      return [{ kind: 'denied', label, subAgent: asked.subAgent, toolId }];
    });
  }

  return (event) => {
    if (!isJson(event)) return [];
    if (event.type === 'assistant') {
      const steps = messageSteps(event, folder);
      for (const step of steps) if (step.toolId) open.set(step.toolId, step);
      return steps;
    }
    const steps = denied(event);
    for (const toolId of answeredToolIds(event)) open.delete(toolId);
    return steps;
  };
}
