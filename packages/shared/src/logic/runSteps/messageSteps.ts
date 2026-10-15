import { RUN_STEP_TEXT_MAX, type RunStepInput } from '../../domain/runStep';
import { cutTo } from './cut';
import { isJson, type Json } from '../json';
import { masked, stepLabel } from './label';
import { todosOf } from './todos';
import { toolLabel } from './toolLabel';

type Step = Omit<RunStepInput, 'subAgent' | 'parentToolId'>;

interface Source {
  folder: string;
  subAgent: boolean;
}

// Claude Code has called the sub agent tool both Task and Agent.
const SUB_AGENT_TOOLS = new Set(['Agent', 'Task']);

// A sub agent keeps a to-do list of its own; the phone shows only the main conversation's.
function toolStep(name: string, toolId: string | null, input: Json, from: Source): Step {
  if (!SUB_AGENT_TOOLS.has(name)) {
    const step: Step = {
      kind: 'tool',
      label: stepLabel(toolLabel(name, input, from.folder)),
      toolId,
    };
    return name === 'TodoWrite' && !from.subAgent ? { ...step, todos: todosOf(input) } : step;
  }
  const description = typeof input.description === 'string' ? input.description : '';
  return { kind: 'agent', label: stepLabel(`Start sub agent: ${description}`), toolId };
}

function stepOfBlock(block: unknown, from: Source): Step[] {
  if (!isJson(block)) return [];
  if (block.type === 'text' && typeof block.text === 'string') {
    const text = block.text.trim();
    // Claude may repeat a command it ran; the run's answer itself stays as Claude wrote it.
    const label = cutTo(masked(text), RUN_STEP_TEXT_MAX);
    return text ? [{ kind: 'text', label, toolId: null }] : [];
  }
  if (block.type !== 'tool_use' || typeof block.name !== 'string') return [];
  const toolId = typeof block.id === 'string' ? block.id : null;
  return [toolStep(block.name, toolId, isJson(block.input) ? block.input : {}, from)];
}

export function messageSteps(event: Json, folder: string): RunStepInput[] {
  const content = isJson(event.message) ? event.message.content : undefined;
  if (!Array.isArray(content)) return [];
  const parentToolId =
    typeof event.parent_tool_use_id === 'string' ? event.parent_tool_use_id : null;
  const subAgent = parentToolId !== null;
  return content
    .flatMap((block) => stepOfBlock(block, { folder, subAgent }))
    .map((step) => (subAgent ? { ...step, subAgent, parentToolId } : { ...step, subAgent }));
}
