import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '@tracker/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { skipAnimations } from '../../src/overlays/testing';
import { SURFACES, type ShownSurface } from './attachmentSurfaces';

const clip = () => new File(['mp4'], 'clip.mp4', { type: 'video/mp4' });

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

// Node stops a request still arriving after its time with a bare 408, so an upload over a slow
// connection ended in a toast that said only "Request Timeout" while the file disappeared.
describe.each(SURFACES)('an upload that fails in $name', (surface) => {
  it('names the file and says why in the picker area', async () => {
    const user = userEvent.setup();
    shown = surface.show({
      uploadAttachment: vi
        .fn()
        .mockRejectedValue(new ApiError(408, 'http_error', 'Request Timeout')),
    });
    await user.upload(shown.input(), clip());

    const note = await within(shown.area()).findByRole('alert');
    expect(within(note).getByText("clip.mp4 didn't upload.")).toBeInTheDocument();
    expect(
      within(note).getByText('It took too long to send. Try again on a faster connection.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Request Timeout')).not.toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });
});
