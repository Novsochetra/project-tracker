import { describe, expect, it } from 'vitest';
import { attachment } from '../../api/test/fixtures';
import { viewerTarget } from './viewerTarget';

const shot = attachment('a');
const clip = attachment('v', { fileName: 'clip.mov', mimeType: 'video/quicktime' });
const notes = attachment('t', { fileName: 'notes.txt', mimeType: 'text/plain' });
const second = attachment('b', { mimeType: 'image/jpeg' });
const spec = attachment('p', { fileName: 'spec.pdf', mimeType: 'application/pdf' });
const all = [shot, clip, notes, second, spec];

describe('viewerTarget', () => {
  it('opens an image among the images only, where the viewer pages', () => {
    expect(viewerTarget(all, 3)).toEqual({ kind: 'image', images: [shot, second], index: 1 });
  });

  it('plays a video and previews a text file on their own', () => {
    expect(viewerTarget(all, 1)).toEqual({ kind: 'video', attachment: clip });
    expect(viewerTarget(all, 2)).toEqual({ kind: 'text', attachment: notes });
  });

  it('leaves PDFs to the browser', () => {
    expect(viewerTarget(all, 4)).toEqual({ kind: 'link', url: spec.url });
  });

  it('has nothing to open past the end', () => {
    expect(viewerTarget(all, 9)).toBeNull();
  });
});
