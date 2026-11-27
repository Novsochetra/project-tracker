import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { setSoundsOn, SOUND_STORAGE_KEY } from '../../sound/soundSetting';
import { SoundSection } from './SoundSection';

afterEach(() => {
  setSoundsOn(true);
  localStorage.clear();
});

describe('SoundSection', () => {
  it('turns the sounds off and on, and says what they are', async () => {
    const user = userEvent.setup();
    render(<SoundSection />);
    const toggle = screen.getByRole('switch', { name: 'Sounds' });
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    expect(toggle).toHaveAccessibleDescription(/chime when one is done/);
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(localStorage.getItem(SOUND_STORAGE_KEY)).toBe('off');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-checked', 'true');
  });
});
