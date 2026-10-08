import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NavBar } from '../../src/navigation/NavBar';
import { NavBarButton } from '../../src/navigation/NavBarButton';
import { mockPhone } from '../../src/overlays/testing';
import { phoneStyle, pixels } from './phoneCss';

const MODULE = 'navigation/NavBar.module.css';
const NAME = 'Marketing website redesign for the 2026 launch';

let restore: () => void;

beforeEach(() => {
  restore = mockPhone(true);
});

afterEach(() => {
  restore();
});

function renderBar() {
  render(
    <NavBar
      title={NAME}
      backLabel="Projects"
      onBack={() => undefined}
      right={
        <>
          <NavBarButton aria-label="Project options">•••</NavBarButton>
          <NavBarButton aria-label="New ticket">+</NavBarButton>
        </>
      }
    />,
  );
  const back = screen.getByRole('button', { name: 'Back to Projects' });
  const title = screen.getByText(NAME);
  return { bar: back.closest('header')!, back, label: screen.getByText('Projects'), title };
}

// Splits a track list at its top-level spaces: "minmax(0, 1fr) auto" → ["minmax(0, 1fr)", "auto"].
function tracks(list = ''): string[] {
  return list.match(/(?:[^\s(]+\([^)]*\)|[^\s()]+)/g) ?? [];
}

const minOf = (track = ''): string => /^minmax\(([^,]+),/.exec(track)?.[1]!.trim() ?? track;

function columns(bar: Element): { back: string; title: string; actions: string } {
  const style = phoneStyle(bar, MODULE);
  expect(style.get('display')).toBe('grid');
  const [back, title, actions] = tracks(style.get('grid-template-columns')).map(minOf);
  return { back: back ?? '', title: title ?? '', actions: actions ?? '' };
}

const ellipsizes = (element: Element) => {
  const style = phoneStyle(element, MODULE);
  return [style.get('overflow'), style.get('text-overflow'), style.get('white-space')];
};

// The sides were flex: 1 1 0 with min-width: 0 and the title kept its full width, so a long
// project name collapsed the sides and was drawn over the back chevron, ••• and +.
describe('regression: a long nav bar title never covers the back button or the actions', () => {
  it('keeps a back column and a back button at least 44px wide, with an ellipsized label', () => {
    const { bar, back, label } = renderBar();
    expect(pixels(columns(bar).back)).toBeGreaterThanOrEqual(44);
    const button = phoneStyle(back, MODULE);
    expect(pixels(button.get('min-width'))).toBeGreaterThanOrEqual(44);
    expect(pixels(button.get('min-height'))).toBeGreaterThanOrEqual(44);
    expect(ellipsizes(label)).toEqual(['hidden', 'ellipsis', 'nowrap']);
  });

  it('gives the action buttons the full width of their content', () => {
    const { bar } = renderBar();
    expect(['min-content', 'max-content']).toContain(columns(bar).actions);
  });

  it('lets the title shrink to the space left and end in an ellipsis', () => {
    const { bar, title } = renderBar();
    expect(pixels(columns(bar).title)).toBe(0);
    expect(ellipsizes(title)).toEqual(['hidden', 'ellipsis', 'nowrap']);
  });
});
