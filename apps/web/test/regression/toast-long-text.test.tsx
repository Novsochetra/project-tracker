import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NETWORK_ERROR_MESSAGE } from '../../src/api/errors';
import { ToastProvider, useToast, useToastRaise } from '../../src/components/Toast';
import { mockPhone } from '../../src/overlays/testing';
import { phoneStyle, pixels } from './phoneCss';

// Toasts never wrapped, so on phones a long one ended in an ellipsis. In WebKit "Can't reach the
// tracker. Check your connection." takes 310px: it read "…Check you…" at 320px, where its line
// has 236px, and "…connec…" at 375px (291px). Beside Undo at 320px (190px), "MOB-12 moved to In
// progress" (194px) and "MOB-12 moved to Need review" (202px) lost their last letters.

const MODULE = 'components/Toast/Toast.module.css';
const WIDTHS = [320, 375];
const ICON = 16;

function Trigger({ text, undo }: { text: string; undo: (() => void) | undefined }) {
  const toast = useToast();
  useToastRaise(true);
  const options = undo ? { undo } : { kind: 'error' as const };
  return (
    <button type="button" onClick={() => toast.show(text, options)}>
      Show
    </button>
  );
}

function renderToast(text: string, undo?: () => void) {
  const view = render(
    <ToastProvider>
      <Trigger text={text} undo={undo} />
    </ToastProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Show' }));
  const label = screen.getByText(text, { exact: true });
  const toast = label.parentElement!;
  return {
    view,
    region: screen.getByRole('status'),
    toast,
    label,
    icon: toast.querySelector('svg')!,
    undoButton: toast.querySelector('button'),
  };
}

const keepsOneLine = (element: Element, width: number) =>
  phoneStyle(element, MODULE, width).get('white-space') === 'nowrap';

let restore: () => void;

beforeEach(() => {
  restore = mockPhone(true);
});

afterEach(() => restore());

describe('regression: a toast too long for a phone wraps instead of ending in an ellipsis', () => {
  it('shows all of its text, a failure or a move with Undo', () => {
    for (const [text, undo] of [
      [NETWORK_ERROR_MESSAGE, undefined],
      ['MOB-12 moved to Need review', vi.fn()],
    ] as const) {
      const { view, toast, label } = renderToast(text, undo);
      for (const width of WIDTHS) {
        expect(keepsOneLine(toast, width) || keepsOneLine(label, width)).toBe(false);
        const style = phoneStyle(label, MODULE, width);
        expect(style.get('text-overflow')).not.toBe('ellipsis');
        // A server message can hold a long path or URL with nowhere to break.
        expect(style.get('overflow-wrap')).toBe('anywhere');
      }
      view.unmount();
    }
  });

  it('grows upward from above the bottom bar, so a second line never covers the bar', () => {
    const { region, toast } = renderToast(NETWORK_ERROR_MESSAGE);
    for (const width of WIDTHS) {
      const style = phoneStyle(region, MODULE, width);
      expect(style.get('bottom')).toMatch(/^calc\(88px \+ /);
      expect(style.get('align-items')).toBe('flex-end');
      expect(phoneStyle(toast, MODULE, width).has('height')).toBe(false);
    }
  });

  // Undo beside the first line would rise out of the 44px band that catches a double tap's second
  // tap; beside the last line it stays where a one-line toast has it.
  it('keeps the icon beside the first line, and Undo’s 44px target beside the last', () => {
    const { toast, icon, undoButton } = renderToast('MOB-12 moved to In progress', vi.fn());
    for (const width of WIDTHS) {
      expect(phoneStyle(toast, MODULE, width).get('align-items')).toBe('flex-start');
      expect(phoneStyle(icon, MODULE, width).get('margin-top')).toBe(
        `calc((1.5em - ${ICON}px) / 2)`,
      );
      const target = phoneStyle(undoButton!, MODULE, width);
      expect(target.get('align-self')).toBe('flex-end');
      expect([pixels(target.get('min-width')), pixels(target.get('min-height'))]).toEqual([44, 44]);
    }
  });
});
