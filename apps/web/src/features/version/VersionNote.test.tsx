import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithApi } from '../claude/test/renderWithApi';
import { VersionNote } from './VersionNote';

const meta = (commit: string | null) => ({ version: '1.2.3', commit });

describe('VersionNote', () => {
  it('shows the tracker’s version and the commit it was built from', async () => {
    renderWithApi(<VersionNote />, { getMeta: vi.fn().mockResolvedValue(meta('a1b2c3d')) });
    expect(await screen.findByText('Tracker v1.2.3 · a1b2c3d')).toBeInTheDocument();
  });

  it('leaves the commit out when the build has none', async () => {
    renderWithApi(<VersionNote />, { getMeta: vi.fn().mockResolvedValue(meta(null)) });
    expect(await screen.findByText('Tracker v1.2.3')).toBeInTheDocument();
  });

  it('shows nothing while the version is unknown', () => {
    renderWithApi(<VersionNote />, {
      getMeta: vi.fn().mockReturnValue(new Promise(() => undefined)),
    });
    expect(screen.queryByText(/^Tracker v/)).not.toBeInTheDocument();
  });
});
