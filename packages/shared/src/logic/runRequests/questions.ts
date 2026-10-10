import {
  RUN_QUESTION_HEADER_MAX,
  RUN_QUESTION_MAX,
  RUN_QUESTION_OPTION_DESCRIPTION_MAX,
  RUN_QUESTION_OPTION_MAX,
  RUN_QUESTION_OPTIONS_MAX,
  RUN_QUESTIONS_MAX,
  type RunQuestion,
  type RunQuestionOption,
} from '../../domain/runRequest';
import { isJson, type Json } from '../json';
import { cutTo, oneLine } from '../runSteps/cut';

const textOf = (value: unknown, max: number): string =>
  typeof value === 'string' ? cutTo(oneLine(value), max) : '';

const listOf = (value: unknown): Json[] => (Array.isArray(value) ? value.filter(isJson) : []);

function optionOf(option: Json): RunQuestionOption | null {
  const label = textOf(option.label, RUN_QUESTION_OPTION_MAX);
  if (!label) return null;
  return { label, description: textOf(option.description, RUN_QUESTION_OPTION_DESCRIPTION_MAX) };
}

function questionOf(question: Json): RunQuestion | null {
  const text = textOf(question.question, RUN_QUESTION_MAX);
  if (!text) return null;
  return {
    question: text,
    header: textOf(question.header, RUN_QUESTION_HEADER_MAX),
    options: listOf(question.options)
      .map(optionOf)
      .filter((option) => option !== null)
      .slice(0, RUN_QUESTION_OPTIONS_MAX),
    multiSelect: question.multiSelect === true,
  };
}

// Their order is kept: the answers go back to Claude by position, under its full question text.
export function questionsOf(input: unknown): RunQuestion[] {
  if (!isJson(input)) return [];
  const all = listOf(input.questions).map(questionOf);
  if (all.some((question) => question === null)) return [];
  return (all as RunQuestion[]).slice(0, RUN_QUESTIONS_MAX);
}
