import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { APPEARANCE_STORAGE_KEY, setAppearanceChoice } from '../../appearance';
import { playSound } from '../../sound';
import { AppearanceSection } from './AppearanceSection';

vi.mock('../../sound', () => ({ playSound: vi.fn() }));

afterEach(() => {
  setAppearanceChoice('system');
  localStorage.clear();
  vi.mocked(playSound).mockClear();
});

const choices = () => screen.getByRole('group', { name: 'Appearance' });
const choice = (name: string) => within(choices()).getByRole('button', { name });

describe('AppearanceSection', () => {
  it('follows the system until the person picks, and says what System means', () => {
    render(<AppearanceSection />);
    expect(screen.getByRole('heading', { name: 'Appearance' })).toBeInTheDocument();
    expect(choice('System')).toHaveAttribute('aria-pressed', 'true');
    expect(choices()).toHaveAccessibleDescription(/follows this device’s light or dark setting/);
  });

  it('keeps Dark for the next visit, with the segmented control’s tick', async () => {
    const user = userEvent.setup();
    render(<AppearanceSection />);
    await user.click(choice('Dark'));
    expect(choice('Dark')).toHaveAttribute('aria-pressed', 'true');
    expect(localStorage.getItem(APPEARANCE_STORAGE_KEY)).toBe('dark');
    expect(playSound).toHaveBeenCalledWith('tick');
    await user.click(choice('Light'));
    expect(localStorage.getItem(APPEARANCE_STORAGE_KEY)).toBe('light');
  });
});
