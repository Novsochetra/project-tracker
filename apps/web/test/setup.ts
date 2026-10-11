import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach } from 'vitest';
import { FRESH_READS_STORAGE_KEY } from '../src/api/freshReads';
import { clearHandleFocus } from '../src/features/project/dnd/handleFocus';
import { clearSends } from '../src/features/ticket/activity/sentComments';
import { clearRefusedDrafts } from '../src/features/ticket/drafts/syncDrafts';
import { clearSaves } from '../src/features/ticket/fields/fieldSaves';
import { endHolds } from '../src/lib/holdPresses';
import { clearStoredDrafts } from '../src/lib/storedDrafts';

// Tests wait for what they need to see, however long a loaded machine takes to render it (booting
// the whole app took over 2s with parallel runs). The default 1s turned slowness into failures;
// a longer limit only makes a real failure take longer to report.
configure({ asyncUtilTimeout: 5_000 });

afterEach(() => {
  cleanup();
  // A move whose request never answers keeps asking for its handle's focus, which the next test's
  // screen would honour.
  clearHandleFocus();
  // A field save that never answers would keep its draft 'saving' in the next test, its kept
  // text would open there as unsaved, a refusal would keep the next test's sync from sending the
  // same text, a comment on its way would come back in the next test's box when its page goes, and
  // a write would have the next test's pages read that ticket fresh.
  clearSaves();
  clearSends();
  // A hold whose time ran out after the file's page had gone threw there (PT-167).
  endHolds();
  clearRefusedDrafts();
  clearStoredDrafts();
  window.localStorage.removeItem(FRESH_READS_STORAGE_KEY);
});
