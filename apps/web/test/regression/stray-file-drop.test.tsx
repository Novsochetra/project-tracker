import { render } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { fakeClient } from '../../src/api/test/fakeClient';
import { createTestQueryClient } from '../../src/api/test/render';
import { TrackerApp } from '../../src/app/TrackerApp';

// The guard lives at the root; the screens behind the session gate don't matter here.
vi.mock('../../src/app/Shell', () => ({ Shell: () => null }));

function fileDrag(type: 'dragover' | 'drop', types = ['Files']): Event {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'dataTransfer', {
    value: { types, files: [], items: [], dropEffect: 'copy' },
  });
  return event;
}

function renderApp() {
  const client = fakeClient({
    getSession: () => new Promise(() => undefined),
  });
  render(<TrackerApp client={client} queryClient={createTestQueryClient()} />);
}

// A file dropped outside the two drop zones (side panel, activity cards, header) made the
// browser open it and leave the app, losing an unsent comment.
it('keeps a file dropped outside the drop zones from opening in the browser', () => {
  renderApp();
  const over = fileDrag('dragover');
  document.body.dispatchEvent(over);
  expect(over.defaultPrevented).toBe(true);
  expect((over as DragEvent).dataTransfer?.dropEffect).toBe('none');
  const drop = fileDrag('drop');
  document.body.dispatchEvent(drop);
  expect(drop.defaultPrevented).toBe(true);
});

it('leaves text drags to the browser', () => {
  renderApp();
  const drop = fileDrag('drop', ['text/plain']);
  document.body.dispatchEvent(drop);
  expect(drop.defaultPrevented).toBe(false);
});
