import { act, render, screen } from '@testing-library/react';
import { ApiError } from '@tracker/client';
import { useEffect } from 'react';
import { describe, expect, it } from 'vitest';
import { ToastProvider } from '../../components';
import { noticeTitle } from './fileNotice';
import { useFileNotice, type FileNotices } from './useFileNotice';

let latest: FileNotices | null = null;
const keep = (notices: FileNotices) => {
  latest = notices;
};

function Probe() {
  const notices = useFileNotice();
  useEffect(() => keep(notices));
  return null;
}

function Screen({ open }: { open: boolean }) {
  return <ToastProvider>{open && <Probe />}</ToastProvider>;
}

const timedOut = () => new ApiError(408, 'http_error', 'Request Timeout');

describe('useFileNotice', () => {
  it('keeps a failure in the note while its screen is open', () => {
    render(<Screen open />);
    act(() => latest?.failed('clip.mov', timedOut()));
    const notice = latest?.notices.failed;
    expect(notice && noticeTitle(notice)).toBe("clip.mov didn't upload.");
    expect(screen.queryByText("clip.mov didn't upload.")).not.toBeInTheDocument();
  });

  it('tells of a failure in a toast once its screen has closed', () => {
    const { rerender } = render(<Screen open />);
    const failed = latest?.failed;
    rerender(<Screen open={false} />);
    act(() => failed?.('clip.mov', timedOut()));
    expect(screen.getByText("clip.mov didn't upload.")).toBeInTheDocument();
  });

  it('clears the notes on a pick that is all taken, and on a dismiss', () => {
    render(<Screen open />);
    act(() => latest?.picked([{ name: 'notes.svg', reason: 'No.' }]));
    expect(latest?.notices.refused).not.toBeNull();
    act(() => latest?.failed('clip.mov', timedOut()));
    act(() => latest?.picked([]));
    expect(latest?.notices).toEqual({ refused: null, failed: null });
    act(() => latest?.failed('clip.mov', timedOut()));
    expect(latest?.notices.failed).not.toBeNull();
    act(() => latest?.dismiss());
    expect(latest?.notices).toEqual({ refused: null, failed: null });
  });

  it("keeps a pick's refusal beside a later failure, and dismisses each alone", () => {
    render(<Screen open />);
    act(() => latest?.picked([{ name: 'notes.svg', reason: 'No.' }]));
    act(() => latest?.failed('clip.mov', timedOut()));
    const { refused, failed } = latest?.notices ?? {};
    expect(refused && noticeTitle(refused)).toBe("notes.svg can't be attached.");
    expect(failed && noticeTitle(failed)).toBe("clip.mov didn't upload.");
    act(() => latest?.dismiss('refused'));
    expect(latest?.notices.refused).toBeNull();
    expect(latest?.notices.failed).toBe(failed);
  });
});
