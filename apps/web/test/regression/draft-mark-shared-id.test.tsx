import { fireEvent, render } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { clearDraft, hasDrafts, markDraft } from '../../src/lib/drafts';
import { useDraftMark } from '../../src/lib/useDraftMark';
import { isSafeToReload } from '../../src/pwa/reloadPolicy';

// The draft registry was a Set: when two mounted components marked the same id, the first one to
// let go cleared the other's mark too, and an app update could reload the page over its text.

function Marker({ id }: { id: string }) {
  useDraftMark(id, true);
  return null;
}

function TwoMarkers() {
  const [first, setFirst] = useState(true);
  return (
    <>
      {first && <Marker id="comment:MOB-3" />}
      <Marker id="comment:MOB-3" />
      <button type="button" onClick={() => setFirst(false)}>
        Close the first
      </button>
    </>
  );
}

afterEach(() => {
  clearDraft('capture');
});

describe('regression: components that share a draft id keep each other’s mark', () => {
  it('holds the reload while one of two marks on an id remains', () => {
    const view = render(<TwoMarkers />);
    fireEvent.click(view.getByRole('button', { name: 'Close the first' }));
    expect(hasDrafts()).toBe(true);
    expect(isSafeToReload(document)).toBe(false);
    view.unmount();
    expect(hasDrafts()).toBe(false);
  });

  it('needs one clear for each mark made by hand', () => {
    markDraft('capture');
    markDraft('capture');
    clearDraft('capture');
    expect(hasDrafts()).toBe(true);
  });
});
