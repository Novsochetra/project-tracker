// Values from the dark set in tokens.css that colors computed in code are checked against;
// test/regression/data-colors-contrast keeps them equal to the tokens.
// --surface takes both: #1C1C1E for cards on the page, #2C2C2E for a grouped area's cards (a
// board card, a phone sheet's card). A chip tinted over the lighter one reads on both.
export const DARK_SURFACES = ['#1c1c1e', '#2c2c2e'] as const;
export const DARK_CHIP_SURFACE = DARK_SURFACES[1];
// --fill-2: the lightest background a status glyph or a label dot sits on (a selected status
// tab's thumb, a pressed row).
export const DARK_MARK_BACKGROUND = '#3a3a3c';
