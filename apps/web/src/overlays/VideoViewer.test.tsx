import { createEvent, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { skipAnimations } from './testing';
import { VideoViewer } from './VideoViewer';

const clip = { url: '/api/attachments/v/file', label: 'clip.mov' };

let restore: Array<() => void> = [];

beforeEach(() => {
  const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockReturnValue(undefined);
  restore = [skipAnimations(), () => play.mockRestore(), () => pause.mockRestore()];
});

afterEach(() => {
  restore.forEach((undo) => undo());
});

function Player({ onClose = () => undefined }: { onClose?: () => void }) {
  const [open, setOpen] = useState(true);
  return (
    <VideoViewer
      video={clip}
      open={open}
      onClose={() => {
        onClose();
        setOpen(false);
      }}
    />
  );
}

const viewer = () => screen.getByRole('dialog', { name: 'Video viewer' });
const stage = () => viewer().querySelector('.stage') as HTMLElement;

type PointerType = 'pointerDown' | 'pointerMove' | 'pointerUp';

// Events at a finger's pace (60 ms apart), so the release speed is a real one.
function pointer(type: PointerType, at: number, x: number, y: number) {
  const init = { pointerId: 3, pointerType: 'touch', isPrimary: true, button: 0 };
  const event = createEvent[type](stage(), { ...init, clientX: x, clientY: y });
  Object.defineProperty(event, 'timeStamp', { value: at });
  fireEvent(stage(), event);
}

function drag(dx: number, dy: number) {
  pointer('pointerDown', 1000, 100, 100);
  pointer('pointerMove', 1060, 100 + dx / 2, 100 + dy / 2);
  pointer('pointerMove', 1120, 100 + dx, 100 + dy);
  pointer('pointerUp', 1120, 100 + dx, 100 + dy);
}

describe('VideoViewer', () => {
  it('plays the video in the page with the native controls', () => {
    render(<Player />);
    const video = viewer().querySelector('video');
    expect(video).toHaveAttribute('src', clip.url);
    expect(video).toHaveAttribute('controls');
    // Without it iOS jumps to full screen as soon as the video plays.
    expect(video).toHaveAttribute('playsinline');
    expect(video).toHaveAccessibleName('clip.mov');
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();
  });

  it('closes with Escape and the close button, pausing the video', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<Player onClose={onClose} />);
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    render(<Player onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('closes when swiped down far enough', () => {
    const onClose = vi.fn();
    render(<Player onClose={onClose} />);
    drag(10, 40);
    expect(onClose).not.toHaveBeenCalled();
    drag(10, 220);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('leaves sideways drags and upward drags to the video, as scrubbing does', () => {
    const onClose = vi.fn();
    render(<Player onClose={onClose} />);
    drag(220, 30);
    drag(0, -220);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('renders nothing without a video', () => {
    render(<VideoViewer video={null} open onClose={vi.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
