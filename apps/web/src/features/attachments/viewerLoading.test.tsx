import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { attachment } from '../../api/test/fixtures';
import { skipAnimations } from '../../overlays/testing';

// The viewers' code arrives when its gate opens, like a chunk on a slow network; a failing one is
// like a chunk a new build replaced.
const code = {
  asked: 0,
  arrive: () => undefined as void,
  arrived: Promise.resolve(),
  fails: false,
};

const viewersModule = async (importOriginal: () => Promise<unknown>) => {
  code.asked += 1;
  await code.arrived;
  if (code.fails) throw new TypeError('Failed to fetch dynamically imported module');
  return importOriginal();
};

const shot = attachment('a');
const clip = attachment('v', { fileName: 'clip.mov', mimeType: 'video/quicktime' });
const notes = attachment('t', { fileName: 'notes.txt', mimeType: 'text/plain', size: 30 });
const second = attachment('b', { mimeType: 'image/jpeg' });
const FILES = [shot, clip, notes, second];

function holdCode(): void {
  code.arrived = new Promise((resolve) => (code.arrive = resolve));
}

// Until the parts have it, which this test's fresh modules share with the screen.
async function arrive(): Promise<void> {
  const { ImageViewer } = await import('./viewerParts');
  await act(async () => {
    code.arrive();
    await ImageViewer.preload();
  });
}

// Outside act and with timeouts held: through Suspense, React holds content back for 300 ms after
// its fallback showed, on a timeout, so a viewer that waited for that would not show here.
async function arriveWithTimeoutsHeld(): Promise<void> {
  const { ImageViewer } = await import('./viewerParts');
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  try {
    code.arrive();
    await ImageViewer.preload();
    for (let turn = 0; turn < 5; turn += 1) await new Promise((resolve) => setImmediate(resolve));
  } finally {
    vi.useRealTimers();
  }
}

// Fresh modules each time, so every test starts with the viewers' code not yet asked for.
async function renderTicketFiles() {
  vi.resetModules();
  vi.doMock('./viewers', viewersModule);
  const [{ AttachmentViewerProvider }, { ThumbnailGrid }, { useAttachmentViewer }, api, ui] =
    await Promise.all([
      import('./AttachmentViewerProvider'),
      import('./ThumbnailGrid'),
      import('./viewerContext'),
      import('../../api/test/render'),
      import('../../components'),
    ]);
  function Grid() {
    const viewer = useAttachmentViewer();
    return <ThumbnailGrid attachments={FILES} onOpen={(index) => viewer.open(FILES, index)} />;
  }
  const Wrapper = api.setupApi({ fetchAttachmentText: () => Promise.resolve('line one') }).wrapper;
  render(
    <Wrapper>
      <ui.ToastProvider>
        <AttachmentViewerProvider>
          <Grid />
        </AttachmentViewerProvider>
      </ui.ToastProvider>
    </Wrapper>,
  );
  return userEvent.setup();
}

const tile = (name: string) => screen.getByRole('button', { name });
const opening = () => screen.queryByText('Opening');

let restore: Array<() => void> = [];
let consoleError: MockInstance<typeof console.error>;

beforeEach(() => {
  code.asked = 0;
  code.arrived = Promise.resolve();
  code.fails = false;
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockReturnValue(undefined);
  restore = [skipAnimations(), () => play.mockRestore(), () => pause.mockRestore()];
});

afterEach(() => {
  restore.forEach((undo) => undo());
  consoleError.mockRestore();
});

describe('the attachment viewers load when a file is first opened', () => {
  it('asks for no viewer code with the screen, only once a tile is pressed', async () => {
    const user = await renderTicketFiles();
    expect(code.asked).toBe(0);
    await user.pointer({ keys: '[MouseLeft>]', target: tile('Open image 2') });
    await vi.waitFor(() => expect(code.asked).toBe(1));
    await user.pointer({ keys: '[/MouseLeft]', target: tile('Open image 2') });
    const viewer = await screen.findByRole('dialog', { name: 'Image viewer' });
    expect(within(viewer).getByText('2 / 2')).toBeInTheDocument();
    expect(code.asked).toBe(1);
  });

  it('loads the text preview with them, from a press on a text file', async () => {
    const user = await renderTicketFiles();
    await user.pointer({ keys: '[MouseLeft>]', target: tile('Open notes.txt') });
    await vi.waitFor(() => expect(code.asked).toBe(1));
    await user.pointer({ keys: '[/MouseLeft]', target: tile('Open notes.txt') });
    const sheet = await screen.findByRole('dialog', { name: 'notes.txt' });
    expect(await within(sheet).findByText('line one')).toBeInTheDocument();
  });

  it('starts loading on a key press on a tile, before the press opens it', async () => {
    await renderTicketFiles();
    fireEvent.keyDown(tile('Play video 1'), { key: 'Enter' });
    await vi.waitFor(() => expect(code.asked).toBe(1));
  });

  it('opens at once, with no opening state, when the code arrived between press and release', async () => {
    holdCode();
    const user = await renderTicketFiles();
    await user.pointer({ keys: '[MouseLeft>]', target: tile('Play video 1') });
    await arrive();
    await user.pointer({ keys: '[/MouseLeft]', target: tile('Play video 1') });
    expect(screen.getByRole('dialog', { name: 'Video viewer' })).toBeInTheDocument();
    expect(opening()).not.toBeInTheDocument();
  });

  it('shows a quiet opening state while the code is on its way, then the viewer', async () => {
    holdCode();
    const user = await renderTicketFiles();
    await user.click(tile('Open image 1'));
    expect(screen.queryByRole('dialog', { name: 'Image viewer' })).not.toBeInTheDocument();
    // Nothing for a moment (--delay-quiet), so a fast load shows no spinner.
    expect(opening()?.closest('.quiet-in')).toBeInTheDocument();
    await arriveWithTimeoutsHeld();
    expect(screen.getByRole('dialog', { name: 'Image viewer' })).toBeInTheDocument();
    expect(opening()).not.toBeInTheDocument();
  });

  it('opens only the latest file tapped while the code was on its way', async () => {
    holdCode();
    const user = await renderTicketFiles();
    await user.click(tile('Open image 1'));
    await user.click(tile('Play video 1'));
    expect(screen.getAllByText('Opening')).toHaveLength(1);
    await arrive();
    expect(await screen.findByRole('dialog', { name: 'Video viewer' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Image viewer' })).not.toBeInTheDocument();
  });

  it('says so when the code fails to load, each time, and the files stay', async () => {
    code.fails = true;
    const user = await renderTicketFiles();
    await user.click(tile('Open image 1'));
    expect(
      await screen.findByText("Couldn't open the image. Reload to try again."),
    ).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opening()).not.toBeInTheDocument();
    await user.click(tile('Play video 1'));
    expect(
      await screen.findByText("Couldn't play the video. Reload to try again."),
    ).toBeInTheDocument();
    await user.click(tile('Open notes.txt'));
    expect(
      await screen.findByText("Couldn't open the file. Reload to try again."),
    ).toBeInTheDocument();
    await user.click(tile('Open image 2'));
    expect(
      await screen.findByText("Couldn't open the image. Reload to try again."),
    ).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(tile('Open image 1')).toBeInTheDocument();
  });
});
