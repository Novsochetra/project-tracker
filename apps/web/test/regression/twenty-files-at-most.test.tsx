import { waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { skipAnimations } from '../../src/overlays/testing';
import {
  CAPTURE,
  COMMENT_BOX,
  NEW_TICKET,
  TICKET_SCREEN,
  type ShownSurface,
} from './attachmentSurfaces';

const logs = (count: number) =>
  Array.from(
    { length: count },
    (_, index) => new File(['boom'], `crash-${index + 1}.log`, { type: 'text/plain' }),
  );

const neverAnswers = () => vi.fn(() => new Promise(() => undefined));

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

// A new ticket or comment takes 20 files, but all 21 picked uploaded and Create answered with
// zod's "Too big: expected array to have <=20 items".
describe.each([
  { surface: NEW_TICKET, limit: 'A new ticket can have up to 20 files.' },
  { surface: CAPTURE, limit: 'A new ticket can have up to 20 files.' },
  { surface: COMMENT_BOX, limit: 'A comment can have up to 20 files.' },
])('$surface.name', ({ surface, limit }) => {
  it('stops at 20 when picking and says so in plain words', async () => {
    const user = userEvent.setup();
    shown = surface.show({ uploadAttachment: neverAnswers() });
    await user.upload(shown.input(), logs(21));

    await waitFor(() => expect(shown?.client.uploadAttachment).toHaveBeenCalledTimes(20));
    const note = within(shown.area()).getByRole('alert');
    expect(note).toHaveTextContent("crash-21.log can't be attached.");
    expect(note).toHaveTextContent(limit);

    await user.upload(shown.input(), logs(2));
    expect(within(shown.area()).getByRole('alert')).toHaveTextContent(
      "crash-1.log and 1 more can't be attached.",
    );
    expect(shown.client.uploadAttachment).toHaveBeenCalledTimes(20);
  });
});

it('lets the ticket screen take more, since its files go straight to the ticket', async () => {
  const user = userEvent.setup();
  shown = TICKET_SCREEN.show({ uploadAttachment: neverAnswers() });
  await user.upload(shown.input(), logs(21));
  await waitFor(() => expect(shown?.client.uploadAttachment).toHaveBeenCalledTimes(21));
  expect(within(shown.area()).queryByRole('alert')).not.toBeInTheDocument();
});
