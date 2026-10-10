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
} from 'lucide-react';
import { describe, expect, it } from 'vitest';
import { stepIcon } from './stepIcon';

const tool = (label: string) => stepIcon({ kind: 'tool', label });

describe('stepIcon', () => {
  it('shows what kind of call Claude asks for', () => {
    expect(tool('Read apps/web/src/x.ts')).toBe(FileText);
    expect(tool('Edit x.ts')).toBe(Pencil);
    expect(tool('Write notes.txt')).toBe(Pencil);
    expect(tool('Run npm run verify')).toBe(SquareTerminal);
    expect(tool("Search for 'foo' in apps/server")).toBe(Search);
    expect(tool("Find files matching '*.ts'")).toBe(Search);
    expect(tool("Search the web for 'kysely'")).toBe(Globe);
    expect(tool('Fetch https://example.com/docs')).toBe(Globe);
    expect(tool('Update the to-do list')).toBe(ListChecks);
    expect(tool('Ask: Which file name should I use?')).toBe(MessageCircleQuestion);
  });

  it('knows a verb with no detail, and shows a tool for any other call', () => {
    expect(tool('Read')).toBe(FileText);
    expect(tool('Use tracker: claim_ticket PT-12')).toBe(Wrench);
    expect(tool('Reader')).toBe(Wrench);
  });

  it('shows a sub agent, a refusal and Claude’s words apart from calls', () => {
    expect(stepIcon({ kind: 'agent', label: 'Start sub agent: Find it' })).toBe(Bot);
    expect(stepIcon({ kind: 'denied', label: 'Not allowed: Run ls' })).toBe(Ban);
    expect(stepIcon({ kind: 'text', label: 'Run the tests next.' })).toBe(MessageSquareText);
  });
});
