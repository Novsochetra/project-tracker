import { expect, it } from 'vitest';
import { phoneRule } from './phoneCss';

// PT-251: PT-222 added Auto as a fourth Mode segment, but the Mode switch still shared the chips'
// line down to 360px, so on a 375px phone its four labels ran together. The two chips and four
// segments with their padding need about 440px. jsdom lays out nothing, so this checks the rule
// (e2e "fits the options row and the placeholder on a 320px screen" measures it).

const ROW = 'features/ask/AskOptionsRow.module.css';

it.each([320, 360, 375, 390, 414, 430])('gives the Mode switch its own line at %ipx', (width) => {
  expect(phoneRule(ROW, '.row', width).get('flex-wrap')).toBe('wrap');
  expect(phoneRule(ROW, '.mode', width).get('flex-basis')).toBe('100%');
});

it('keeps the chips and the Mode switch on one line at 440px', () => {
  expect(phoneRule(ROW, '.row', 440).get('flex-wrap')).toBeUndefined();
});
