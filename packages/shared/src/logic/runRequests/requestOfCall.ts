import { RUN_REQUEST_LABEL_MAX, type RunRequestInput } from '../../domain/runRequest';
import { cutTo } from '../runSteps/cut';
import { permissionLabel } from './permissionLabel';
import { questionsOf } from './questions';

// Claude Code sends its questions to the permission prompt tool as a call of this tool.
export const QUESTION_TOOL = 'AskUserQuestion';

const isJson = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

// Never the tool's whole input, which for a Write holds the file.
export function requestOfCall(
  toolName: string,
  input: unknown,
  folder: string,
): RunRequestInput | null {
  if (toolName !== QUESTION_TOOL) {
    const label = permissionLabel(toolName, isJson(input) ? input : {}, folder);
    return { kind: 'permission', label, questions: null };
  }
  const questions = questionsOf(input);
  const [first] = questions;
  if (!first) return null;
  return { kind: 'question', label: cutTo(first.question, RUN_REQUEST_LABEL_MAX), questions };
}
