import { describe, expect, it } from 'vitest';
import { buildAskPrompt } from '../src/logic/askPrompt';

const project = { key: 'PT', name: 'Project Tracker' };

describe('buildAskPrompt', () => {
  it('names the project, says it is read-only and ends with the question', () => {
    const prompt = buildAskPrompt({ project, question: 'Where are runs queued?', history: [] });
    expect(prompt).toContain('"Project Tracker" (PT)');
    expect(prompt).toContain('read-only');
    expect(prompt.endsWith('Question:\nWhere are runs queued?')).toBe(true);
    expect(prompt).not.toContain('Earlier in this chat');
  });

  it('shows how to write a ticket card the parser reads', () => {
    expect(buildAskPrompt({ project, question: 'q', history: [] })).toContain(
      '````ticket\ntitle: <short title>\npriority: high | medium | low\n---',
    );
  });

  it('puts earlier messages before the question when the session can not be resumed', () => {
    const prompt = buildAskPrompt({
      project,
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
});
