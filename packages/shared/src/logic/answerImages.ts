import { CHAT_ANSWER_IMAGES_MAX } from '../domain/chat';
import { codeFences, type CodeFence } from './codeFences';

// A path longer than any a computer takes is no path, so a huge line is never kept.
export const ANSWER_IMAGE_PATH_MAX = 1024;

const QUOTED = /^(["'`])(.+)\1$/;

const linesOf = (text: string) => text.replace(/\r/g, '').split('\n');

const isImageCard = (fence: CodeFence) => fence.end !== -1 && fence.info.toLowerCase() === 'image';

const imageCards = (lines: readonly string[]) => codeFences(lines).filter(isImageCard);

function pathOf(lines: readonly string[], { start, end }: CodeFence): string | null {
  const line = lines.slice(start + 1, end).find((body) => body.trim() !== '');
  if (!line || line.length > ANSWER_IMAGE_PATH_MAX) return null;
  const path = line
    .trim()
    .replace(/^path[ \t]*:/i, '')
    .trim();
  return (QUOTED.exec(path)?.[2] ?? path) || null;
}

// The image cards of Claude's answer, in order: the paths of the pictures it shows (PT-225).
export function answerImagePaths(text: string): string[] {
  const lines = linesOf(text);
  return imageCards(lines)
    .map((fence) => pathOf(lines, fence))
    .filter((path): path is string => path !== null)
    .slice(0, CHAT_ANSWER_IMAGES_MAX);
}

// The pictures show under the answer, so their cards are left out of the words.
export function withoutImageCards(text: string): string {
  const lines = linesOf(text);
  const cards = imageCards(lines);
  if (cards.length === 0) return text;
  const hidden = new Set<number>();
  for (const { start, end } of cards) for (let at = start; at <= end; at += 1) hidden.add(at);
  return lines
    .filter((_, at) => !hidden.has(at))
    .join('\n')
    .trim();
}
