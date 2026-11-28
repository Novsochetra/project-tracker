import { describe, expect, it } from 'vitest';
import { APPEARANCES, blendFlash, color, contrast, mix, rgb } from './contrast';

// WCAG AA for text under 24px (18.66px bold), which every color here draws somewhere.
const AA_TEXT = 4.5;

// Text color → background → what sits there. Hover, selection and drop targets count, and so do
// placeholders: an empty field shows nothing else. The row flash multiplies the row, its text too, so
// text on the flash color itself is the stricter case.
const TEXT_ON: Record<string, Record<string, string>> = {
  '--ink': {
    '--surface': 'titles, row and field text',
    '--fill': 'group header names, the sidebar, hovered rows',
    '--fill-2': 'hovered segments and menu items',
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
    '--control-fill': 'unselected segments on the track',
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
    '--surface': 'counts in titles and the board pager; project keys',
    '--thumb': 'the count on the selected status tab',
    '--fill': 'sidebar, group header and board column counts, "No tickets"',
    '--control-fill': 'counts on unselected status tabs',
    '--drop-tint': 'counts in a group or column a ticket is dragged into',
  },
  '--placeholder': {
    '--surface': 'field placeholders, "Unassigned", "None", activity times',
    '--row-hover': '"None" on a hovered property row',
    '--control-fill': 'the phone search field',
    '--report-bg': 'report card times, the comment box while images are dragged over it',
    '--fill': 'the weekday of a hovered quick pick in the desktop calendar',
  },
  '--accent-text': {
    '--surface': 'today in the desktop calendar, action sheet choices, menu checks',
    '--fill-2': 'a hovered today in the desktop calendar',
    '--fill': 'a hovered menu item’s check',
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
    '--ink': 'primary buttons, sheet bar buttons, the floating New ticket button',
    '--ink-hover': 'a hovered primary button',
  },
  '--text-on-tint': {
    '--danger-fill': 'danger buttons, the Delete swipe action',
    '--accent': 'the chosen day in the desktop calendar, the swipe action that moves a ticket on',
    '--swipe-neutral': 'the Status swipe action',
    '--swipe-dark': 'the swipe action beside it',
  },
  '--toast-text': {
    '--toast-bg': 'toasts',
  },
  '--accent-inverse': {
    '--toast-bg': 'Undo in a toast',
    '--toast-hover': 'a hovered Undo',
  },
};

// Backgrounds the dark appearance draws apart (tokens.css): the black page under the raised
// surfaces, a grouped area's raised cards and fills (phone sheets, board columns, the sidebar) and
// a sheet's controls. In the light appearance each is one of the colors above.
const RAISED_TEXT_ON: Record<string, Record<string, string>> = {
  '--ink': {
    '--page': 'the ticket title and description, large titles',
    '--grouped-surface': 'cards in a phone sheet and on the board',
    '--grouped-fill': 'a pressed row in a phone sheet',
    '--grouped-fill-2': 'the selected sidebar item',
    '--grouped-thumb': 'the selected segment in a sheet',
    '--grouped-panel': 'a status being edited in a phone sheet',
    '--menu-bg': 'menu and popover rows',
    '--menu-highlight': 'the highlighted menu row',
    '--menu-pressed': 'a pressed menu row',
  },
  '--ink-2': {
    '--page': 'the ticket description',
    '--grouped-surface': 'descriptions on board cards',
  },
  '--muted': {
    '--page': 'activity events, notes under a section',
    '--grouped-bg': 'notes on a phone sheet, sidebar section labels',
    '--grouped-surface': 'property values in a phone sheet',
    '--grouped-control-fill': 'unselected segments in a sheet',
    '--grouped-panel': 'the Color label of a status being edited in a phone sheet',
    '--menu-bg': "the label picker's empty state",
  },
  '--muted-2': {
    '--page': 'the repository path',
    '--grouped-surface': 'due dates on board cards',
  },
  '--subtle': {
    '--page': 'the count beside a large title',
    '--grouped-bg': 'sidebar and board column counts',
    '--grouped-fill-2': 'the count of the selected sidebar item',
  },
  '--placeholder': {
    '--page': 'activity times',
    '--grouped-surface': 'placeholders and "None" in a phone sheet',
    '--grouped-row-hover': '"None" on a hovered row in a sheet',
    '--grouped-control-fill': 'a search field in a sheet',
  },
  '--accent-text': {
    '--menu-bg': 'menu checks',
    '--menu-highlight': 'the check on a highlighted menu row',
    '--grouped-bg': 'Close and Cancel on a grouped phone sheet',
    '--grouped-surface': 'tinted choices in a phone sheet’s cards',
  },
  '--danger': {
    '--page': 'the overdue date on the ticket',
    '--grouped-surface': 'overdue dates on board cards',
    '--grouped-bg': 'Sign out everywhere on a phone sheet',
    '--grouped-panel': 'Delete status in a phone sheet',
  },
  '--link': {
    '--page': 'links in a description or comment',
    '--menu-highlight': 'Create “name” highlighted in the label picker',
  },
};

const SECONDARY = ['--muted', '--subtle', '--placeholder'];

const pairsOf = (table: Record<string, Record<string, string>>) =>
  Object.entries(table).flatMap(([text, backgrounds]) =>
    Object.entries(backgrounds).map(([background, usage]) => ({ text, background, usage })),
  );

const pairs = APPEARANCES.flatMap((appearance) =>
  [...pairsOf(TEXT_ON), ...pairsOf(RAISED_TEXT_ON)].map((pair) => ({ ...pair, appearance })),
);

describe('regression: text colors reach WCAG AA (4.5:1) on the backgrounds they sit on', () => {
  it.each(pairs)(
    '$appearance: $text on $background: $usage',
    ({ text, background, appearance }) => {
      const ratio = contrast(color(text, appearance), color(background, appearance));
      expect(ratio, `${text} on ${background} is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(
        AA_TEXT,
      );
    },
  );

  // The light flash multiplies the row and its text, so text on the flash color itself is the
  // stricter case and the table checks it. The dark one lightens both, so it checks them blended.
  it.each(['--ink', '--muted', '--muted-2', '--danger'])(
    'dark: %s stays readable under the flash of a row that just moved',
    (text) => {
      for (const row of ['--surface', '--row-hover', '--fill', '--grouped-surface']) {
        const ratio = contrast(
          blendFlash(color(text, 'dark'), 'dark'),
          blendFlash(color(row, 'dark'), 'dark'),
        );
        expect(ratio, `${text} under the flash on ${row}`).toBeGreaterThanOrEqual(AA_TEXT);
      }
    },
  );

  // A chip's tint is mixed over the --surface it sits on: a card on the page, or a grouped
  // area's raised card.
  it.each(
    APPEARANCES.flatMap((appearance) =>
      ['--surface', '--grouped-surface'].flatMap((surface) =>
        [
          ['--accent', '--accent-text'],
          ['--danger', '--danger'],
        ].map(([verdict, text]) => ({ appearance, surface, verdict: verdict!, text: text! })),
      ),
    ),
  )(
    '$appearance: $verdict verdict chips on their own 10% tint over $surface',
    ({ appearance, surface, verdict, text }) => {
      const chip = mix(color(verdict, appearance), color(surface, appearance), 0.1);
      expect(contrast(color(text, appearance), chip)).toBeGreaterThanOrEqual(AA_TEXT);
    },
  );
});

// The product call on PT-31: legibility wins over the design's hex values for text, but secondary
// text keeps its bluish gray and its order: Muted reads strongest against the surface, then
// Subtle, then Placeholder (darker to lighter in the light appearance, the other way in the dark).
describe.each(APPEARANCES)('secondary text colors (%s)', (appearance) => {
  it('keep Muted stronger than Subtle, and Subtle stronger than Placeholder', () => {
    const surface = color('--surface', appearance);
    const [muted, subtle, placeholder] = SECONDARY.map((token) =>
      contrast(color(token, appearance), surface),
    );
    expect(muted).toBeGreaterThan(subtle!);
    expect(subtle).toBeGreaterThan(placeholder!);
  });

  it.each(SECONDARY)('%s stays a bluish gray', (token) => {
    const [red, green, blue] = color(token, appearance);
    expect(red).toBe(green);
    expect(blue).toBeGreaterThan(red);
  });
});

describe('the contrast check', () => {
  it('matches known WCAG ratios', () => {
    expect(contrast(rgb('#000000'), rgb('#ffffff'))).toBeCloseTo(21, 5);
    expect(contrast(rgb('#ffffff'), rgb('#767676'))).toBeCloseTo(4.54, 2);
    expect(contrast(rgb('#777777'), rgb('#ffffff'))).toBeLessThan(AA_TEXT);
  });
});
