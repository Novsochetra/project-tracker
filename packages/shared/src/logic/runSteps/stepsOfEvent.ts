import { RUN_STEP_LABEL_MAX, RUN_STEP_TEXT_MAX, type RunStepInput } from '../../domain/runStep';
import { cutTo, oneLine } from './cut';
import { toolLabel, type ToolInput } from './toolLabel';

type Step = Omit<RunStepInput, 'subAgent'>;
type Json = Readonly<Record<string, unknown>>;

const isJson = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

// Claude Code has called the sub agent tool both Task and Agent.
const SUB_AGENT_TOOLS = new Set(['Agent', 'Task']);

const labelOf = (text: string): string => cutTo(oneLine(text), RUN_STEP_LABEL_MAX);

function toolStep(name: string, input: ToolInput, folder: string): Step {
  if (!SUB_AGENT_TOOLS.has(name))
    return { kind: 'tool', label: labelOf(toolLabel(name, input, folder)) };
  const description = typeof input.description === 'string' ? input.description : '';
  return { kind: 'agent', label: labelOf(`Started sub agent: ${description}`) };
}

function stepOfBlock(block: unknown, folder: string): Step[] {
  if (!isJson(block)) return [];
  if (block.type === 'text' && typeof block.text === 'string') {
    const text = block.text.trim();
    return text ? [{ kind: 'text', label: cutTo(text, RUN_STEP_TEXT_MAX) }] : [];
  }
  if (block.type === 'tool_use' && typeof block.name === 'string') {
    return [toolStep(block.name, isJson(block.input) ? block.input : {}, folder)];
  }
  return [];
}

// One line of claude -p --output-format stream-json --verbose. Only what Claude says and the tools
// it calls become steps: tool results, thinking and the final result never leave the computer.
export function stepsOfEvent(event: unknown, folder: string): RunStepInput[] {
  if (!isJson(event) || event.type !== 'assistant' || !isJson(event.message)) return [];
  const { content } = event.message;
  if (!Array.isArray(content)) return [];
  const subAgent = typeof event.parent_tool_use_id === 'string';
  return content
    .flatMap((block) => stepOfBlock(block, folder))
    .map((step) => ({ ...step, subAgent }));
}
