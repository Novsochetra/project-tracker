import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach } from 'vitest';
import { clearHandleFocus } from '../src/features/project/dnd/handleFocus';

// Tests wait for what they need to see, however long a loaded machine takes to render it (booting
// the whole app took over 2s with parallel runs). The default 1s turned slowness into failures;
// a longer limit only makes a real failure take longer to report.
configure({ asyncUtilTimeout: 5_000 });

afterEach(() => {
  cleanup();
  // A move whose request never answers keeps asking for its handle's focus, which the next test's
  // screen would honour.
  clearHandleFocus();
});
