import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetListView } from '../../src/features/project/listViewStore';
import { renderProject } from '../../src/features/project/test/renderProject';
import { mockPhone, skipAnimations } from '../../src/overlays/testing';

// A status tab with no tickets said "No tickets match." in the list, though nothing was searched
// (PT-63 review).

vi.mock('../../src/features/projects/ProjectOptionsButton', () => ({
  ProjectOptionsButton: () => null,
}));

let restore: Array<() => void> = [];

beforeEach(() => {
  restore = [skipAnimations(), mockPhone(false)];
});

afterEach(() => {
  restore.forEach((undo) => undo());
  resetListView('MOB');
});

const tab = (name: RegExp) =>
  within(screen.getByLabelText('Filter tickets')).getByRole('button', { name });

describe('regression: an empty status tab names its status', () => {
  it('says "No tickets in Need review", and "No tickets match." only for a search', async () => {
    const user = userEvent.setup();
    renderProject();
    await screen.findByRole('region', { name: 'To do' });
    await user.click(tab(/^Need review/));
    expect(screen.getByText('No tickets in Need review')).toBeInTheDocument();
    expect(screen.queryByText('No tickets match.')).not.toBeInTheDocument();

    await user.type(screen.getByLabelText('Search tickets'), 'login');
    expect(screen.getByText('No tickets match.')).toBeInTheDocument();
  });
});
