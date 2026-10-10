import { describe, expect, it } from 'vitest';
import { buildAskPrompt } from '../src/logic/askPrompt';

const project = { key: 'PT', name: 'Project Tracker' };

describe('buildAskPrompt', () => {
  it('names the project, says it is read-only and ends with the question', () => {
    const prompt = buildAskPrompt({
      project,
      mode: 'ask',
      question: 'Where are runs queued?',
      history: [],
    });
    expect(prompt).toContain('"Project Tracker" (PT)');
    expect(prompt).toContain('read-only');
    expect(prompt.endsWith('Question:\nWhere are runs queued?')).toBe(true);
    expect(prompt).not.toContain('Earlier in this chat');
  });

  it('shows how to write a ticket card the parser reads', () => {
    expect(buildAskPrompt({ project, mode: 'ask', question: 'q', history: [] })).toContain(
      '````ticket\ntitle: <short title>\npriority: high | medium | low\n---',
    );
  });

  it('puts earlier messages before the question when the session can not be resumed', () => {
    const prompt = buildAskPrompt({
      project,
      mode: 'ask',
      question: 'And the helper?',
      history: [
        { role: 'person', text: 'Where are runs queued?' },
        { role: 'claude', text: 'In runQueue.ts.' },
      ],
    });
    expect(prompt).toContain(
      'Earlier in this chat:\n\nPerson:\nWhere are runs queued?\n\nYou:\nIn runQueue.ts.',
    );
    expect(prompt.indexOf('Earlier')).toBeLessThan(prompt.indexOf('Question:'));
  });

  it('keeps Ask and Plan read-only and plans in Plan', () => {
    const plan = buildAskPrompt({ project, mode: 'plan', question: 'q', history: [] });
    expect(plan).toContain('read-only');
    expect(plan).toContain('Make a plan');
  });

  it('never says read-only in Edit and points to the tracker workflow', () => {
    const edit = buildAskPrompt({ project, mode: 'edit', question: 'q', history: [] });
    expect(edit).not.toContain('read-only');
    expect(edit).not.toContain("can't create tickets");
    expect(edit).toContain('submit it for review');
    expect(edit).toContain('Never move a ticket to Done');
  });
});
