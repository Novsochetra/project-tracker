import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Attachment } from '@tracker/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { attachment } from '../../api/test/fixtures';
import { setupApi } from '../../api/test/render';
import { skipAnimations } from '../../overlays/testing';
import { AttachmentViewerProvider } from './AttachmentViewerProvider';
import { TEXT_PREVIEW_MAX_CHARS } from './textPreview';
import { ThumbnailGrid } from './ThumbnailGrid';
import { useAttachmentViewer } from './viewerContext';

const shot = attachment('a');
const clip = attachment('v', { fileName: 'clip.mov', mimeType: 'video/quicktime' });
const notes = attachment('t', { fileName: 'notes.txt', mimeType: 'text/plain', size: 30 });
const second = attachment('b', { mimeType: 'image/jpeg' });

let restore: Array<() => void> = [];

beforeEach(() => {
  const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockReturnValue(undefined);
  restore = [skipAnimations(), () => play.mockRestore(), () => pause.mockRestore()];
});

afterEach(() => {
  restore.forEach((undo) => undo());
});

function Grid({ attachments }: { attachments: Attachment[] }) {
  const viewer = useAttachmentViewer();
  return (
    <ThumbnailGrid attachments={attachments} onOpen={(index) => viewer.open(attachments, index)} />
  );
}

function renderGrid(fetchAttachmentText = vi.fn().mockResolvedValue('line one\nline two')) {
  const api = setupApi({ fetchAttachmentText });
  const Wrapper = api.wrapper;
  render(
    <Wrapper>
      <AttachmentViewerProvider>
        <Grid attachments={[shot, clip, notes, second]} />
      </AttachmentViewerProvider>
    </Wrapper>,
  );
  return { ...api, user: userEvent.setup() };
}

describe('AttachmentViewerProvider', () => {
  it('opens images in the image viewer, counting images only', async () => {
    const { user } = renderGrid();
    await user.click(screen.getByRole('button', { name: 'Open image 2' }));
    const viewer = await screen.findByRole('dialog', { name: 'Image viewer' });
    expect(within(viewer).getByText('2 / 2')).toBeInTheDocument();
  });

  it('plays videos in the video viewer', async () => {
    const { user } = renderGrid();
    await user.click(screen.getByRole('button', { name: 'Play video 1' }));
    const viewer = await screen.findByRole('dialog', { name: 'Video viewer' });
    expect(viewer.querySelector('video')).toHaveAttribute('src', clip.url);
  });

  it('previews a text file, read from the tracker', async () => {
    const { user, client } = renderGrid();
    await user.click(screen.getByRole('button', { name: 'Open notes.txt' }));
    const sheet = await screen.findByRole('dialog', { name: 'notes.txt' });
    const text = await within(sheet).findByText(/line one/);
    expect(text.tagName).toBe('PRE');
    expect(text).toHaveTextContent('line one line two');
    expect(client.fetchAttachmentText).toHaveBeenCalledWith('t');
    expect(within(sheet).queryByText(/Showing the first/)).not.toBeInTheDocument();
    await user.click(within(sheet).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog', { name: 'notes.txt' })).not.toBeInTheDocument();
  });

  it('cuts a long text file and links to the whole of it', async () => {
    const long = 'x'.repeat(TEXT_PREVIEW_MAX_CHARS + 50);
    const { user } = renderGrid(vi.fn().mockResolvedValue(long));
    await user.click(screen.getByRole('button', { name: 'Open notes.txt' }));
    const sheet = await screen.findByRole('dialog', { name: 'notes.txt' });
    expect(
      await within(sheet).findByText('Showing the first 100,000 characters.'),
    ).toBeInTheDocument();
    const whole = within(sheet).getByRole('link', { name: 'Open the whole file' });
    expect(whole).toHaveAttribute('href', notes.url);
    expect(whole).toHaveAttribute('target', '_blank');
  });

  it('says when a text file cannot be read and tries again', async () => {
    const fetchAttachmentText = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValue('second try');
    const { user } = renderGrid(fetchAttachmentText);
    await user.click(screen.getByRole('button', { name: 'Open notes.txt' }));
    const sheet = await screen.findByRole('dialog', { name: 'notes.txt' });
    expect(
      await within(sheet).findByText("Can't reach the tracker. Check your connection."),
    ).toBeInTheDocument();
    await user.click(within(sheet).getByRole('button', { name: 'Try again' }));
    expect(await within(sheet).findByText('second try')).toBeInTheDocument();
  });
});
