import { createEvent, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { pasteImages, useImageDrop } from './useImageDrop';

const shot = new File(['png'], 'shot.png', { type: 'image/png' });

function transfer(files: File[], types = ['Files']) {
  return { files, items: [], types, dropEffect: 'none' };
}

function Zone({ onFiles }: { onFiles: (files: File[]) => void }) {
  const drop = useImageDrop(onFiles);
  return (
    <div data-testid="zone" data-active={drop.active} {...drop.handlers}>
      <span data-testid="child">Description</span>
    </div>
  );
}

describe('useImageDrop', () => {
  it('stays active while dragging over children and hands over dropped files', () => {
    const onFiles = vi.fn();
    render(<Zone onFiles={onFiles} />);
    const zone = screen.getByTestId('zone');
    const child = screen.getByTestId('child');
    fireEvent.dragEnter(zone, { dataTransfer: transfer([shot]) });
    fireEvent.dragEnter(child, { dataTransfer: transfer([shot]) });
    fireEvent.dragLeave(zone, { dataTransfer: transfer([shot]) });
    expect(zone).toHaveAttribute('data-active', 'true');
    fireEvent.drop(child, { dataTransfer: transfer([shot]) });
    expect(zone).toHaveAttribute('data-active', 'false');
    expect(onFiles).toHaveBeenCalledWith([shot]);
  });

  it('turns off when the drag leaves', () => {
    render(<Zone onFiles={vi.fn()} />);
    const zone = screen.getByTestId('zone');
    fireEvent.dragEnter(zone, { dataTransfer: transfer([shot]) });
    fireEvent.dragLeave(zone, { dataTransfer: transfer([shot]) });
    expect(zone).toHaveAttribute('data-active', 'false');
  });

  it('ignores text being dragged', () => {
    const onFiles = vi.fn();
    render(<Zone onFiles={onFiles} />);
    const zone = screen.getByTestId('zone');
    fireEvent.dragEnter(zone, { dataTransfer: transfer([], ['text/plain']) });
    expect(zone).toHaveAttribute('data-active', 'false');
    fireEvent.drop(zone, { dataTransfer: transfer([], ['text/plain']) });
    expect(onFiles).not.toHaveBeenCalled();
  });
});

describe('pasteImages', () => {
  function Field({ onFiles }: { onFiles: (files: File[]) => void }) {
    return <textarea aria-label="Description" onPaste={(event) => pasteImages(event, onFiles)} />;
  }

  function paste(target: HTMLElement, clipboardData: object) {
    const event = createEvent.paste(target, { clipboardData });
    fireEvent(target, event);
    return event;
  }

  it('uploads pasted files instead of pasting their names', () => {
    const onFiles = vi.fn();
    render(<Field onFiles={onFiles} />);
    const event = paste(screen.getByLabelText('Description'), {
      files: [shot],
      items: [],
      types: ['Files', 'text/plain'],
    });
    expect(onFiles).toHaveBeenCalledWith([shot]);
    expect(event.defaultPrevented).toBe(true);
  });

  it('leaves plain text pastes alone', () => {
    const onFiles = vi.fn();
    render(<Field onFiles={onFiles} />);
    const event = paste(screen.getByLabelText('Description'), {
      files: [],
      items: [],
      types: ['text/plain'],
    });
    expect(onFiles).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });
});
