import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { skipAnimations } from '../../overlays/testing';
import { renderWithApp } from '../test/harness';
import { useSheets } from './context';
import { SheetsProvider } from './SheetsProvider';

let restore: () => void = () => undefined;

beforeEach(() => {
  restore = skipAnimations();
});

afterEach(() => {
  restore();
});

function Opener() {
  const sheets = useSheets();
  return (
    <>
      <button type="button" onClick={() => sheets.open({ type: 'newProject' })}>
        Open
      </button>
      <output aria-label="Current">{sheets.current?.type ?? 'none'}</output>
    </>
  );
}

describe('SheetsProvider', () => {
  it('opens the requested sheet and reports it as current', async () => {
    const user = userEvent.setup();
    renderWithApp(
      <SheetsProvider>
        <Opener />
      </SheetsProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'Open' }));
    expect(screen.getByRole('dialog', { name: 'New project' })).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Current' })).toHaveTextContent('newProject');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('status', { name: 'Current' })).toHaveTextContent('none');
  });

  it('starts every opening with a fresh sheet', async () => {
    const user = userEvent.setup();
    renderWithApp(
      <SheetsProvider>
        <Opener />
      </SheetsProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'Open' }));
    await user.type(screen.getByLabelText('Project name'), 'Draft');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Open' }));
    expect(screen.getByLabelText('Project name')).toHaveValue('');
  });
});
