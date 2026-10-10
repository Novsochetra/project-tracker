import { RUN_REQUEST_LABEL_MAX, type RunRequestInput } from '../../domain/runRequest';
import { isJson } from '../json';
import { cutTo } from '../runSteps/cut';
import { permissionLabel } from './permissionLabel';
import { questionsOf } from './questions';

export const QUESTION_TOOL = 'AskUserQuestion';

// Never the tool's whole input, which for a Write holds the file.
export function requestOfCall(
  toolName: string,
  input: unknown,
  folder: string,
): RunRequestInput | null {
  if (toolName !== QUESTION_TOOL) {
    const { label, cut } = permissionLabel(toolName, isJson(input) ? input : {}, folder);
    return { kind: 'permission', label, labelCut: cut, questions: null };
  }
  const questions = questionsOf(input);
  const [first] = questions;
  if (!first) return null;
  const label = cutTo(first.question, RUN_REQUEST_LABEL_MAX);
  return { kind: 'question', label, labelCut: label !== first.question, questions };
}
