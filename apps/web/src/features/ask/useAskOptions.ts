import { chosenAskOptions, type AskOptions } from '@tracker/shared';
import { useState } from 'react';

// Only what the person picked since their last question overrides the chat's saved choice, since
// another device may change that choice while this screen is open.
export function useAskOptions(saved: AskOptions) {
  const [picked, setPicked] = useState<Partial<AskOptions>>({});
  return {
    options: chosenAskOptions(picked, saved),
    pick: (change: Partial<AskOptions>) => setPicked((before) => ({ ...before, ...change })),
    forget: () => setPicked({}),
  };
}
