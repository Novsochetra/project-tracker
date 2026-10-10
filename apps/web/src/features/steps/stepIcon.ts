import {
  Ban,
  Bot,
  FileText,
  Globe,
  ListChecks,
  MessageCircleQuestion,
  MessageSquareText,
  Pencil,
  Search,
  SquareTerminal,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import type { StepRow } from './stepRows';

// The helper's labels start with what Claude asks to do (shared logic/runSteps/toolLabel.ts).
const TOOL_ICONS: ReadonlyArray<readonly [string, LucideIcon]> = [
  ['Read ', FileText],
  ['Edit ', Pencil],
  ['Write ', Pencil],
  ['Run ', SquareTerminal],
  ['Search the web', Globe],
  ['Fetch ', Globe],
  ['Search for', Search],
  ['Find files', Search],
  ['Update the to-do list', ListChecks],
  ['Ask:', MessageCircleQuestion],
];

// A call with no detail is the verb alone ("Read").
const begins = (label: string, start: string): boolean =>
  label.startsWith(start) || label === start.trimEnd();

export function stepIcon({ kind, label }: Pick<StepRow, 'kind' | 'label'>): LucideIcon {
  if (kind === 'denied') return Ban;
  if (kind === 'agent') return Bot;
  if (kind === 'text') return MessageSquareText;
  return TOOL_ICONS.find(([start]) => begins(label, start))?.[1] ?? Wrench;
}
