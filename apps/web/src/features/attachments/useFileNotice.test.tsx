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
    const notice = latest?.notice;
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

  it('clears the note on a pick that is all taken, and on a dismiss', () => {
    render(<Screen open />);
    act(() => latest?.picked([{ name: 'notes.svg', reason: 'No.' }]));
    expect(latest?.notice).not.toBeNull();
    act(() => latest?.picked([]));
    expect(latest?.notice).toBeNull();
    act(() => latest?.failed('clip.mov', timedOut()));
    expect(latest?.notice).not.toBeNull();
    act(() => latest?.dismiss());
    expect(latest?.notice).toBeNull();
  });
});
