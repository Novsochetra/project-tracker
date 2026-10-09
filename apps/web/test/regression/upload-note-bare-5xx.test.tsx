import { within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '@tracker/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { skipAnimations } from '../../src/overlays/testing';
import { SURFACES, type ShownSurface } from './attachmentSurfaces';

// A bare 5xx (no error body) comes from a proxy for a stopped API, but also from the API itself or
// from a proxy whose connection to it broke during one upload. Since PT-101 only a check of the
// tracker shows the offline banner, yet the upload's own note still said "Can't reach the tracker.
// Check your connection." while the tracker answered everything else (PT-101 review).

const shot = () => new File(['png'], 'a.png', { type: 'image/png' });

let shown: ShownSurface | undefined;
let undoAnimations: () => void;

beforeEach(() => {
  undoAnimations = skipAnimations();
});

afterEach(() => {
  shown?.restore();
  undoAnimations();
  localStorage.clear();
});

describe.each(SURFACES)('an upload answered with a bare 5xx in $name', (surface) => {
  it("says the tracker couldn't save it, not that it can't be reached", async () => {
    const user = userEvent.setup();
    shown = surface.show({
      uploadAttachment: vi
        .fn()
        .mockRejectedValue(new ApiError(500, 'http_error', 'Internal Server Error')),
    });
    await user.upload(shown.input(), shot());

    const note = await within(shown.area()).findByRole('alert');
    expect(within(note).getByText("a.png didn't upload.")).toBeInTheDocument();
    expect(within(note).getByText("The tracker couldn't save it. Try again.")).toBeInTheDocument();
    expect(note).not.toHaveTextContent("Can't reach the tracker");
  });
});
