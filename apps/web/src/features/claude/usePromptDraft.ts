import type { PromptResult } from '@tracker/shared';
import { useState } from 'react';
import type { TrackerQuery } from '../../api';

export interface PromptDraft {
  result: PromptResult | null;
  text: string;
  setText: (text: string) => void;
}

interface Seeded {
  result: PromptResult;
  text: string;
}

// Seeds the box once per opening from a fetch made after mount, so neither an older cached
// prompt nor a refetch (sending moves the ticket and changes its prompt) replaces the text.
export function usePromptDraft(query: TrackerQuery<PromptResult>): PromptDraft {
  const fresh = query.isFetchedAfterMount && query.isSuccess ? query.data : undefined;
  const [seeded, setSeeded] = useState<Seeded | null>(null);
  if (!seeded && fresh) setSeeded({ result: fresh, text: fresh.text });
  return {
    result: seeded?.result ?? null,
    text: seeded?.text ?? '',
    setText: (text) => setSeeded((draft) => (draft ? { ...draft, text } : draft)),
  };
}
