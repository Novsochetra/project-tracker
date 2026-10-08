import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { attachment } from '../../api/test/fixtures';
import { AddTile, ThumbnailGrid } from './ThumbnailGrid';
import type { UploadingFile } from './useAttachmentUploads';

const images = [attachment('a'), attachment('b')];
const clip = attachment('v', { fileName: 'clip.mov', mimeType: 'video/quicktime' });
const notes = attachment('t', { fileName: 'notes.txt', mimeType: 'text/plain', size: 2048 });
const spec = attachment('p', {
  fileName: 'spec.pdf',
  mimeType: 'application/pdf',
  size: 1_258_291,
});

const uploading = (overrides: Partial<UploadingFile> = {}): UploadingFile => ({
  key: 'upload-1',
  name: 'clip.mov',
  kind: 'video',
  size: 4096,
  progress: 0.4,
  preview: null,
  ...overrides,
});

describe('ThumbnailGrid', () => {
  it('opens and removes images by their number', async () => {
    const onOpen = vi.fn();
    const onRemove = vi.fn();
    const user = userEvent.setup();
    render(<ThumbnailGrid attachments={images} onOpen={onOpen} onRemove={onRemove} />);
    await user.click(screen.getByRole('button', { name: 'Open image 2' }));
    expect(onOpen).toHaveBeenCalledWith(1);
    await user.click(screen.getByRole('button', { name: 'Remove image 1' }));
    expect(onRemove).toHaveBeenCalledWith('a', 0);
  });

  it('makes room for the x and marks the attachment being removed', () => {
    const { container, rerender } = render(<ThumbnailGrid attachments={images} />);
    expect(container.firstElementChild).not.toHaveClass('removable');
    rerender(<ThumbnailGrid attachments={images} onRemove={vi.fn()} markedId="b" />);
    expect(container.firstElementChild).toHaveClass('removable');
    const tiles = container.querySelectorAll('.tile');
    expect(tiles[0]).not.toHaveClass('marked');
    expect(tiles[1]).toHaveClass('marked');
  });

  it('shows plain images when they cannot be opened', () => {
    render(<ThumbnailGrid attachments={images} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Image 2' })).toHaveAttribute(
      'src',
      '/api/attachments/b/file',
    );
  });

  it('shows each kind of file as its own tile', async () => {
    const onOpen = vi.fn();
    const user = userEvent.setup();
    const { container } = render(
      <ThumbnailGrid attachments={[clip, notes, spec, images[0]!]} onOpen={onOpen} />,
    );

    const video = screen.getByRole('button', { name: 'Play video 1' });
    const poster = video.querySelector('video');
    expect(poster).toHaveAttribute('src', '/api/attachments/v/file#t=0.1');
    expect(poster).toHaveAttribute('preload', 'metadata');
    expect(poster).toHaveProperty('muted', true);
    expect(poster).toHaveAttribute('playsinline');
    Object.defineProperty(poster, 'duration', { value: 75.2 });
    fireEvent.loadedMetadata(poster!);
    expect(video).toHaveTextContent('1:15');

    const text = screen.getByRole('button', { name: 'Open notes.txt' });
    expect(text).toHaveTextContent('notes.txt');
    expect(text).toHaveTextContent('2 KB');
    const pdf = screen.getByRole('link', { name: 'Open spec.pdf' });
    expect(pdf).toHaveAttribute('href', '/api/attachments/p/file');
    expect(pdf).toHaveAttribute('target', '_blank');
    expect(pdf).toHaveAttribute('rel', 'noopener noreferrer');
    expect(pdf).toHaveTextContent('1.2 MB');
    expect(container.querySelectorAll('img')).toHaveLength(1);

    await user.click(video);
    await user.click(text);
    await user.click(screen.getByRole('button', { name: 'Open image 1' }));
    expect(onOpen.mock.calls).toEqual([[0], [1], [3]]);
  });

  it('keeps the end of a file name apart, so a small tile can shorten only its start', () => {
    const logs = ['crash-report-1.log', 'crash-report-2.log'].map((fileName, index) =>
      attachment(`log-${index}`, { fileName, mimeType: 'text/plain' }),
    );
    render(<ThumbnailGrid size="sm" attachments={logs} onOpen={vi.fn()} />);
    const name = screen.getByTitle('crash-report-2.log');
    expect(name).toHaveTextContent('crash-report-2.log');
    expect(within(name).getByText('rt-2.log')).toHaveClass('nameTail');
    expect(within(name).getByText('crash-repo')).toHaveClass('nameHead');
  });

  it('names files in their remove buttons', async () => {
    const onRemove = vi.fn();
    const user = userEvent.setup();
    render(<ThumbnailGrid attachments={[clip, notes]} onRemove={onRemove} />);
    await user.click(screen.getByRole('button', { name: 'Remove notes.txt' }));
    expect(onRemove).toHaveBeenCalledWith('t', 1);
    expect(screen.getByRole('button', { name: 'Remove video 1' })).toBeInTheDocument();
  });

  it('shows files on their way up with their progress and a way to stop them', async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    const { container } = render(
      <ThumbnailGrid
        attachments={images}
        uploading={[
          uploading(),
          uploading({ key: 'upload-2', name: 'log.txt', kind: 'text', progress: 0 }),
        ]}
        onCancel={onCancel}
      >
        <AddTile onClick={vi.fn()} />
      </ThumbnailGrid>,
    );
    expect(container.firstElementChild).toHaveClass('removable');
    const clipBar = screen.getByRole('progressbar', { name: 'Uploading clip.mov' });
    expect(clipBar).toHaveAttribute('aria-valuenow', '40');
    const logBar = screen.getByRole('progressbar', { name: 'Uploading log.txt' });
    expect(logBar).not.toHaveAttribute('aria-valuenow');
    expect(within(logBar.closest('.tile') as HTMLElement).getByText('log.txt')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Remove clip.mov' }));
    expect(onCancel).toHaveBeenCalledWith('upload-1');
  });

  it('previews an image on its way up from the file itself', () => {
    render(
      <ThumbnailGrid
        attachments={[]}
        uploading={[uploading({ name: 'shot.png', kind: 'image', preview: 'blob:local-shot' })]}
      />,
    );
    const tile = screen.getByRole('progressbar', { name: 'Uploading shot.png' }).closest('.tile');
    expect(tile?.querySelector('img')).toHaveAttribute('src', 'blob:local-shot');
  });

  it('adds extra tiles at the end', async () => {
    const onAdd = vi.fn();
    const user = userEvent.setup();
    render(
      <ThumbnailGrid attachments={images}>
        <AddTile onClick={onAdd} />
      </ThumbnailGrid>,
    );
    await user.click(screen.getByRole('button', { name: 'Add files' }));
    expect(onAdd).toHaveBeenCalled();
  });
});
