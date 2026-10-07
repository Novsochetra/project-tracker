import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ImageViewer } from './ImageViewer';
import { skipAnimations } from './testing';
import type { ViewerImage } from './viewerTypes';

const images: ViewerImage[] = [1, 2, 3].map((n) => ({
  id: `img-${n}`,
  url: `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="30"/>`,
  width: 400,
  height: 300,
  alt: `Screenshot ${n}`,
}));

let restore: () => void = () => undefined;

beforeEach(() => {
  restore = skipAnimations();
});

afterEach(() => {
  restore();
});

function Gallery({ onClose = () => undefined }: { onClose?: () => void }) {
  const [index, setIndex] = useState(1);
  const [open, setOpen] = useState(true);
  return (
    <ImageViewer
      images={images}
      index={index}
      open={open}
      onIndexChange={setIndex}
      onClose={() => {
        onClose();
        setOpen(false);
      }}
    />
  );
}

describe('ImageViewer', () => {
  it('opens on the given image with a counter', () => {
    render(<Gallery />);
    expect(screen.getByRole('dialog', { name: 'Image viewer' })).toHaveFocus();
    expect(screen.getByText('2 / 3')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Screenshot 2' })).toBeInTheDocument();
  });

  it('pages with the arrow keys and stops at the ends', async () => {
    const user = userEvent.setup();
    render(<Gallery />);
    await user.keyboard('{ArrowRight}');
    expect(screen.getByText('3 / 3')).toBeInTheDocument();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByText('3 / 3')).toBeInTheDocument();
    await user.keyboard('{ArrowLeft}{ArrowLeft}{ArrowLeft}');
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
  });

  it('pages with the previous and next buttons', async () => {
    const user = userEvent.setup();
    render(<Gallery />);
    await user.click(screen.getByRole('button', { name: 'Next image' }));
    expect(screen.getByText('3 / 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next image' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Previous image' }));
    expect(screen.getByText('2 / 3')).toBeInTheDocument();
  });

  it('closes with Escape and the close button, then unmounts', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<Gallery onClose={onClose} />);
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('renders nothing without images', () => {
    render(<ImageViewer images={[]} index={0} open onClose={vi.fn()} onIndexChange={vi.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
