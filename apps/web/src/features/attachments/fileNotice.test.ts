import { describe, expect, it } from 'vitest';
import { noticeDetail, noticeTitle, refusalNotice, withFailure } from './fileNotice';

const ONLY = 'Only images … can be attached.';

describe('refusalNotice', () => {
  it('names the first refused file and counts the rest, with each reason once', () => {
    const notice = refusalNotice([
      { name: 'notes.svg', reason: ONLY },
      { name: 'logs.zip', reason: ONLY },
      { name: 'long.mov', reason: 'Videos can be up to 100 MB.' },
    ]);
    expect(notice && noticeTitle(notice)).toBe("notes.svg and 2 more can't be attached.");
    expect(notice && noticeDetail(notice)).toBe(`${ONLY} Videos can be up to 100 MB.`);
  });

  it('names a single file alone', () => {
    const notice = refusalNotice([{ name: 'notes.svg', reason: ONLY }]);
    expect(notice && noticeTitle(notice)).toBe("notes.svg can't be attached.");
  });

  it('is nothing when every file was taken', () => {
    expect(refusalNotice([])).toBeNull();
  });
});

describe('withFailure', () => {
  it('starts a note of its own in place of a refusal', () => {
    const refusal = refusalNotice([{ name: 'notes.svg', reason: ONLY }]);
    const notice = withFailure(refusal, 'clip.mov', 'It took too long to send.');
    expect(noticeTitle(notice)).toBe("clip.mov didn't upload.");
    expect(noticeDetail(notice)).toBe('It took too long to send.');
  });

  it('gathers uploads that fail together, as they do when the connection drops', () => {
    const offline = "Can't reach the tracker.";
    const first = withFailure(null, 'clip.mov', offline);
    const notice = withFailure(withFailure(first, 'shot.png', offline), 'notes.txt', offline);
    expect(noticeTitle(notice)).toBe("clip.mov and 2 more didn't upload.");
    expect(noticeDetail(notice)).toBe(offline);
  });
});
