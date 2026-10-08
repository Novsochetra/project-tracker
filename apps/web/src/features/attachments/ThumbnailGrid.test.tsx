import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AddImageTile, ThumbnailGrid } from './ThumbnailGrid';

const images = [
  { id: 'a', url: '/api/attachments/a/file' },
  { id: 'b', url: '/api/attachments/b/file' },
];

describe('ThumbnailGrid', () => {
  it('opens and removes images by their number', async () => {
    const onOpen = vi.fn();
    const onRemove = vi.fn();
    const user = userEvent.setup();
    render(<ThumbnailGrid images={images} onOpen={onOpen} onRemove={onRemove} />);
    await user.click(screen.getByRole('button', { name: 'Open image 2' }));
    expect(onOpen).toHaveBeenCalledWith(1);
    await user.click(screen.getByRole('button', { name: 'Remove image 1' }));
    expect(onRemove).toHaveBeenCalledWith('a');
  });

  it('shows plain images when they cannot be opened', () => {
    render(<ThumbnailGrid images={images} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Attachment 2' })).toHaveAttribute(
      'src',
      '/api/attachments/b/file',
    );
  });

  it('adds a spinner tile per running upload and extra tiles at the end', async () => {
    const onAdd = vi.fn();
    const user = userEvent.setup();
    render(
      <ThumbnailGrid images={images} uploading={2}>
        <AddImageTile onClick={onAdd} />
      </ThumbnailGrid>,
    );
    expect(screen.getAllByText('Uploading image')).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: 'Add images' }));
    expect(onAdd).toHaveBeenCalled();
  });
});
