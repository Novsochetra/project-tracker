export interface JsonLineHandlers {
  onEvent: (event: unknown) => void;
  onText: (line: string) => void;
}

function parsed(line: string): unknown {
  if (!line.startsWith('{')) return undefined;
  try {
    return JSON.parse(line) as unknown;
  } catch {
    return undefined;
  }
}

// stdout arrives in chunks that end anywhere, mid-line too, so a line is read only once it is whole.
export function createJsonLines({ onEvent, onText }: JsonLineHandlers) {
  let partial = '';
  const take = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const event = parsed(trimmed);
    if (event === undefined) onText(trimmed);
    else onEvent(event);
  };
  return {
    // Only the new chunk is split: a tool's result can be one line of megabytes.
    push(chunk: string) {
      const [first = '', ...rest] = chunk.split('\n');
      partial += first;
      if (rest.length === 0) return;
      take(partial);
      partial = rest.pop() ?? '';
      rest.forEach(take);
    },
    end() {
      take(partial);
      partial = '';
    },
  };
}
