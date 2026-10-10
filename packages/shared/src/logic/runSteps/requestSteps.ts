import { RUN_STEP_LABEL_MAX, RUN_STEP_TEXT_MAX, type RunStepInput } from '../../domain/runStep';
import { cutTo, oneLine } from './cut';
import { isJson, type Json } from '../json';
import { maskSecrets } from './secrets';
import { toolLabel } from './toolLabel';

type Step = Omit<RunStepInput, 'subAgent'>;

// Claude Code has called the sub agent tool both Task and Agent.
const SUB_AGENT_TOOLS = new Set(['Agent', 'Task']);

// Masking runs in stdout's listener, so a line of megabytes is cut first; far past anything shown,
// so the cut never splits a secret in the part a step keeps.
const SAFETY_CUT = 65_536;
const masked = (text: string): string => maskSecrets(text.slice(0, SAFETY_CUT));

export const labelOf = (text: string): string => cutTo(oneLine(masked(text)), RUN_STEP_LABEL_MAX);

function toolStep(name: string, toolId: string | null, input: Json, folder: string): Step {
  if (!SUB_AGENT_TOOLS.has(name)) {
    return { kind: 'tool', label: labelOf(toolLabel(name, input, folder)), toolId };
  }
  const description = typeof input.description === 'string' ? input.description : '';
  return { kind: 'agent', label: labelOf(`Start sub agent: ${description}`), toolId };
}

function stepOfBlock(block: unknown, folder: string): Step[] {
  if (!isJson(block)) return [];
  if (block.type === 'text' && typeof block.text === 'string') {
    const text = block.text.trim();
    // Claude may repeat a command it ran; the run's answer itself stays as Claude wrote it.
    const label = cutTo(masked(text), RUN_STEP_TEXT_MAX);
    return text ? [{ kind: 'text', label, toolId: null }] : [];
  }
  if (block.type !== 'tool_use' || typeof block.name !== 'string') return [];
  const toolId = typeof block.id === 'string' ? block.id : null;
  return [toolStep(block.name, toolId, isJson(block.input) ? block.input : {}, folder)];
}

export function requestSteps(event: Json, folder: string): RunStepInput[] {
  const content = isJson(event.message) ? event.message.content : undefined;
  if (!Array.isArray(content)) return [];
  const subAgent = typeof event.parent_tool_use_id === 'string';
  return content
    .flatMap((block) => stepOfBlock(block, folder))
    .map((step) => ({ ...step, subAgent }));
}
