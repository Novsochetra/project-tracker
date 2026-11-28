import { STATUS_COLORS } from '@tracker/shared';
import { render } from '@testing-library/react';
import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { setAppearanceChoice } from '../../src/appearance';
import { ProjectProgressBar } from '../../src/features/projects/ProjectProgressBar';
import { color, contrast, rgb } from './contrast';
import { phoneRule } from './phoneCss';

// WCAG 1.4.11: the done and ready shares carry meaning, so each keeps 3:1 against the track.
// PT-287's review measured the dark accent and the Reviewed green at 2.1–2.2:1 on it.
const AA_GRAPHIC = 3;
const CSS = 'features/projects/ProjectCard.module.css';
const PROGRESS = {
  total: 4,
  done: 1,
  ready: 2,
  open: 1,
  percent: 25,
  doneShare: 25,
  readyShare: 50,
};

afterEach(() => {
  setAppearanceChoice('system');
  localStorage.clear();
});

// The rule as drawn, its token resolved with the light set.
const cssColor = (selector: string) => rgb(phoneRule(CSS, selector).get('background') ?? '');

describe('regression: a project’s progress bar reads in both appearances', () => {
  it('draws the track, the done share and the default ready share in tokens', () => {
    expect(cssColor('.track')).toEqual(color('--fill-2'));
    expect(cssColor('.doneFill')).toEqual(color('--progress-done'));
    expect(cssColor('.readyFill')).toEqual(color('--reviewed'));
  });

  it.each(['light', 'dark'] as const)('keeps 3:1 for each share on the %s track', (appearance) => {
    const track = color('--fill-2', appearance);
    for (const share of ['--progress-done', '--reviewed']) {
      const ratio = contrast(color(share, appearance), track);
      expect(ratio, `${share}: ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(AA_GRAPHIC);
    }
  });

  it.each(STATUS_COLORS)(
    'draws a %s Reviewed status at 3:1 on the dark track, as rendered',
    (reviewed) => {
      const { container } = render(
        <ProjectProgressBar progress={PROGRESS} readyColor={reviewed} />,
      );
      act(() => setAppearanceChoice('dark'));
      const fill = container.querySelectorAll<HTMLElement>('[style*="width"]')[1]!;
      const [red, green, blue] = fill.style.background.match(/\d+/g)!.map(Number);
      const ratio = contrast([red! / 255, green! / 255, blue! / 255], color('--fill-2', 'dark'));
      expect(ratio, `${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(AA_GRAPHIC);
    },
  );
});
