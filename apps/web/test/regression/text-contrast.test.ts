import { describe, expect, it } from 'vitest';
import { color, contrast, luminance, mix, rgb } from './contrast';

// WCAG AA for text under 24px (18.66px bold), which every color here draws somewhere.
const AA_TEXT = 4.5;

// Text color → background → what sits there. Hover, selection and drop targets count, and so do
// placeholders: an empty field shows nothing else. The row flash multiplies the row, its text too, so
// text on the flash color itself is the stricter case.
const TEXT_ON: Record<string, Record<string, string>> = {
  '--ink': {
    '--surface': 'titles, row and field text',
    '--fill': 'group header names, the sidebar, hovered rows',
    '--fill-2': 'the selected sidebar item, hovered segments',
    '--panel': 'the ticket side panel',
    '--report-bg': 'report card titles',
    '--drop-tint': 'the header of a group a ticket is dragged into',
    '--flash': 'the title of a row or card that just moved',
  },
  '--ink-2': {
    '--surface': 'descriptions and comments',
    '--fill': 'the prompt box and setup commands',
    '--report-bg': 'report text',
  },
  '--muted': {
    '--surface': 'secondary text, property values, activity events',
    '--fill': 'list headers, sidebar section labels, the offline banner',
    '--fill-2': 'unselected segments on the track',
    '--panel': 'side panel labels and notes',
    '--report-bg': 'report section labels and "Submitted for review"',
    '--flash': 'the key and a done title of a row or card that just moved',
  },
  '--muted-2': {
    '--surface': 'due dates, repo paths',
    '--fill-2': 'the "waiting to sync" chip',
    '--flash': 'the due date of a row or card that just moved',
  },
  '--subtle': {
    '--surface': 'counts on the selected segment, in titles and the board pager; project keys',
    '--fill': 'sidebar, group header and board column counts, "No tickets"',
    '--fill-2': 'counts on unselected segments and the selected sidebar item',
    '--drop-tint': 'counts in a group or column a ticket is dragged into',
  },
  '--placeholder': {
    '--surface': 'field placeholders, "Unassigned", "None", activity times',
    '--row-hover': '"None" on a hovered property row',
    '--fill-2': 'the phone search field',
    '--report-bg': 'report card times, the comment box while images are dragged over it',
  },
  '--danger': {
    '--surface': 'errors, overdue dates, delete actions',
    '--fill': 'a hovered delete menu item',
    '--fill-2': 'a pressed delete button in an action sheet',
    '--panel': 'Delete ticket and unsaved-field notes in the side panel',
    '--flash': 'the overdue date of a row or card that just moved',
  },
  '--link': {
    '--surface': 'links, Retry under fields',
    '--panel': 'Retry under the assignee',
    '--report-bg': 'the targeted drop zone, links in report cards',
  },
  '--link-hover': {
    '--surface': 'hovered links and Retry',
    '--panel': 'hovered Retry in the side panel',
    '--report-bg': 'hovered links in report cards',
  },
  '--text-inverse': {
    '--ink': 'primary buttons, toasts',
    '--danger': 'danger buttons',
  },
  '--surface': {
    '--ink': 'sheet bar buttons',
    '--accent': 'the swipe action that moves a ticket on',
    '--muted': 'the Status swipe action',
    '--danger': 'the Delete swipe action',
  },
};

const SECONDARY = ['--muted', '--subtle', '--placeholder'];

const pairs = Object.entries(TEXT_ON).flatMap(([text, backgrounds]) =>
  Object.entries(backgrounds).map(([background, usage]) => ({ text, background, usage })),
);

describe('regression: text colors reach WCAG AA (4.5:1) on the backgrounds they sit on', () => {
  it.each(pairs)('$text on $background: $usage', ({ text, background }) => {
    const ratio = contrast(color(text), color(background));
    expect(ratio, `${text} on ${background} is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(
      AA_TEXT,
    );
  });

  it.each(['--accent', '--danger'])('%s verdict chips on their own 10%% tint', (verdict) => {
    const chip = mix(color(verdict), color('--surface'), 0.1);
    expect(contrast(color(verdict), chip)).toBeGreaterThanOrEqual(AA_TEXT);
  });
});

// The product call on PT-31: legibility wins over the design's hex values for text, but secondary
// text keeps its bluish gray and its order from dark to light.
describe('secondary text colors', () => {
  it('keep Muted darker than Subtle, and Subtle darker than Placeholder', () => {
    const [muted, subtle, placeholder] = SECONDARY.map((token) => luminance(color(token)));
    expect(muted).toBeLessThan(subtle!);
    expect(subtle).toBeLessThan(placeholder!);
  });

  it.each(SECONDARY)('%s stays a bluish gray', (token) => {
    const [r, g, b] = color(token);
    expect(r).toBe(g);
    expect(b).toBeGreaterThan(r);
  });
});

describe('the contrast check', () => {
  it('matches known WCAG ratios', () => {
    expect(contrast(rgb('#000000'), rgb('#ffffff'))).toBeCloseTo(21, 5);
    expect(contrast(rgb('#ffffff'), rgb('#767676'))).toBeCloseTo(4.54, 2);
    expect(contrast(rgb('#777777'), rgb('#ffffff'))).toBeLessThan(AA_TEXT);
  });
});
