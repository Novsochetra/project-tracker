import { DEFAULT_ASK_OPTIONS, type Chat, type ChatDetail, type ChatMessage } from '@tracker/shared';
import { makeRun } from './runFixtures';

export const makeChat = (overrides: Partial<Chat> = {}): Chat => ({
  id: 'c-1',
  projectKey: 'MOB',
  title: 'How does sync work?',
  ticket: null,
  options: DEFAULT_ASK_OPTIONS,
  waiting: false,
  createdAt: Date.now() - 60_000,
  updatedAt: Date.now() - 60_000,
  ...overrides,
});

export const makeMessage = (overrides: Partial<ChatMessage> = {}): ChatMessage => ({
  id: 'm-1',
  chatId: 'c-1',
  role: 'person',
  text: 'How does sync work?',
  ticketKey: null,
  runId: null,
  stepCount: 0,
  usage: null,
  createdAt: Date.now() - 60_000,
  ...overrides,
});

export const makeAskRun = (overrides: Parameters<typeof makeRun>[0] = {}) =>
  makeRun({
    id: 'r-ask',
    kind: 'ask',
    ticketKey: null,
    chatId: 'c-1',
    askOptions: DEFAULT_ASK_OPTIONS,
    ...overrides,
  });

export const makeChatDetail = (overrides: Partial<ChatDetail> = {}): ChatDetail => ({
  chat: makeChat(),
  messages: [
    makeMessage(),
    makeMessage({ id: 'm-2', role: 'claude', text: 'It reads the queue every minute.' }),
  ],
  run: makeAskRun({ status: 'done', endedAt: Date.now() }),
  stoppedRuns: [],
  ...overrides,
});

export const ticketCardText = (title: string, priority = 'high'): string =>
  [
    'Here is a ticket:',
    '```ticket',
    `Title: ${title}`,
    `Priority: ${priority}`,
    '---',
    'Why: sync is slow.',
    '```',
    'Tap Create when it looks right.',
  ].join('\n');
