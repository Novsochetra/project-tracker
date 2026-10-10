import { readFileSync } from 'node:fs';

// Real lines from Claude Code 2.1.296 (claude -p --output-format stream-json --verbose, model
// haiku), trimmed: the init event keeps its main fields, and the run's folder reads /work/app.
export const STREAM_FOLDER = '/work/app';

export const STREAMS = [
  'ask-user-question',
  'background-sub-agent',
  'denied-by-hook',
  'denied-by-person',
  'sub-agent',
] as const;

export const streamEvents = (name: (typeof STREAMS)[number]): unknown[] =>
  readFileSync(new URL(`./stream-json/${name}.jsonl`, import.meta.url), 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line) as unknown);
