import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { parseDiff } from '@tracker/shared';
import { describe, expect, it, vi } from 'vitest';
import { DiffView } from './DiffView';
import { SAMPLE_DIFF } from './test/sampleDiff';

const files = parseDiff(SAMPLE_DIFF);
const fileButton = (path: RegExp) => screen.getByRole('button', { name: path });

describe('DiffView', () => {
  it('lists the files first, each with its counts, and opens one to its lines', async () => {
    const { container } = render(<DiffView files={files} />);
    expect(
      within(screen.getByRole('list', { name: 'Changed files' })).getAllByRole('listitem'),
    ).toHaveLength(2);
    expect(fileButton(/src\/a\.ts/)).toHaveAccessibleName('src/a.ts, 1 added, 1 removed');
    expect(container.querySelector('[data-kind]')).toBeNull();
    await userEvent.click(fileButton(/src\/a\.ts/));
    expect(fileButton(/src\/a\.ts/)).toHaveAttribute('aria-expanded', 'true');
    const kinds = [...container.querySelectorAll('[data-kind]')].map((line) => [
      line.getAttribute('data-kind'),
      line.textContent,
    ]);
    expect(kinds).toEqual([
      ['context', '11Line 1: const x = 1;'],
      ['del', '2−Removed line 2: const y = 2;'],
      ['add', '2+Added line 2: const y = 3;'],
    ]);
    await userEvent.click(fileButton(/logo\.png/));
    expect(screen.getByText("A binary file: its change can't be shown.")).toBeInTheDocument();
  });

  it('ticks a file as viewed and closes it, when the file has not changed since', async () => {
    const onViewedChange = vi.fn();
    const [first] = files;
    const viewed = { 'logo.png': files[1]!.digest, 'src/a.ts': 'older' };
    render(<DiffView files={files} viewed={viewed} onViewedChange={onViewedChange} />);
    const ticks = screen.getAllByRole('checkbox', { name: /Viewed/ });
    expect(ticks.map((tick) => (tick as HTMLInputElement).checked)).toEqual([false, true]);
    await userEvent.click(fileButton(/src\/a\.ts/));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Viewed src/a.ts' }));
    expect(onViewedChange).toHaveBeenCalledWith(first, true);
    expect(fileButton(/src\/a\.ts/)).toHaveAttribute('aria-expanded', 'false');
  });

  it('tells which line a tap is on, and shows what goes under a line', async () => {
    const onLineSelect = vi.fn();
    render(
      <DiffView
        files={files}
        onLineSelect={onLineSelect}
        belowLine={(file, at) =>
          at.side === 'old' ? <p>{`Under ${file.path} old ${at.line}`}</p> : null
        }
      />,
    );
    await userEvent.click(fileButton(/src\/a\.ts/));
    await userEvent.click(screen.getByRole('button', { name: /Added line 2/ }));
    expect(onLineSelect).toHaveBeenCalledWith(files[0], { side: 'new', line: 2 });
    expect(screen.getByText('Under src/a.ts old 2')).toBeInTheDocument();
  });
});
