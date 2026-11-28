import { render } from '@testing-library/react';
import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { markColor, setAppearanceChoice } from '../../appearance';
import { ColorMark } from './ColorMark';

afterEach(() => {
  setAppearanceChoice('system');
  localStorage.clear();
});

const background = (container: HTMLElement) =>
  container.querySelector('span')!.style.getPropertyValue('background');

describe('ColorMark', () => {
  it('fills with the data color as it is in the light appearance', () => {
    const { container } = render(<ColorMark color="#5B5BD6" />);
    expect(background(container)).toBe('rgb(91, 91, 214)');
    expect(container.querySelector('span')).toHaveAttribute('aria-hidden', 'true');
  });

  it('takes the lighter tint markColor gives it in the dark appearance', () => {
    const { container } = render(<ColorMark color="#5B5BD6" />);
    act(() => setAppearanceChoice('dark'));
    const shown = document.createElement('span');
    shown.style.background = markColor('#5B5BD6', 'dark');
    expect(background(container)).toBe(shown.style.getPropertyValue('background'));
    expect(background(container)).not.toBe('rgb(91, 91, 214)');
  });

  it('draws no fill without a color', () => {
    const { container } = render(<ColorMark color={undefined} />);
    expect(background(container)).toBe('');
  });
});
